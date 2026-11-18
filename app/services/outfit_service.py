"""搭配业务逻辑：增删改查、画布布局保存。"""

from __future__ import annotations

import sqlite3

from ..db import get_conn
from ..errors import NotFoundError, ServiceError, ValidationError
from ..models import dump_list, row_to_dict, rows_to_dicts
from ..utils import logger, now_precise, now_str

VIEWS = ("flat", "worn")
MAX_ITEMS = 60


def _validate_meta(data: dict) -> dict:
    """校验搭配名称与场景标签。"""
    name = (data.get("name") or "").strip()
    if not name:
        raise ValidationError("请填写搭配名称")
    if len(name) > 40:
        raise ValidationError("搭配名称最多 40 个字")

    scenes = [
        item.strip()
        for item in (data.get("scenes") or [])
        if isinstance(item, str) and item.strip()
    ][:8]
    notes = (data.get("notes") or "").strip() or None
    return {"name": name, "scenes": scenes, "notes": notes}


# ---------------------------------------------------------------- 查询


def list_outfits(filters: dict | None = None) -> list[dict]:
    """搭配列表，带画布布局（用于封面预览）、件数和类别。"""
    filters = filters or {}
    sql = "SELECT * FROM outfits WHERE 1 = 1"
    args: list[object] = []

    scene = (filters.get("scene") or "").strip()
    if scene:
        sql += " AND scenes LIKE ?"
        args.append(f'%"{scene}"%')

    keyword = (filters.get("q") or "").strip()
    if keyword:
        sql += " AND name LIKE ?"
        args.append(f"%{keyword}%")

    sql += " ORDER BY updated_at DESC, id DESC"

    conn = get_conn()
    try:
        outfits = rows_to_dicts(conn.execute(sql, args).fetchall())
        if not outfits:
            return []

        ids = [item["id"] for item in outfits]
        placeholders = ",".join("?" for _ in ids)
        rows = conn.execute(
            f"SELECT oi.outfit_id, oi.garment_id, oi.x, oi.y, oi.scale, "
            f"       oi.rotation, oi.z_index, g.category, gi.path AS front_path "
            f"FROM outfit_items oi "
            f"JOIN garments g ON g.id = oi.garment_id "
            f"LEFT JOIN garment_images gi "
            f"  ON gi.garment_id = g.id AND gi.angle = 'front' "
            f"WHERE oi.outfit_id IN ({placeholders}) AND oi.view = 'flat' "
            f"ORDER BY oi.outfit_id, oi.z_index, oi.id",
            ids,
        ).fetchall()

        grouped: dict[int, list[dict]] = {}
        for row in rows:
            grouped.setdefault(row["outfit_id"], []).append(
                {
                    "garment_id": row["garment_id"],
                    "x": row["x"],
                    "y": row["y"],
                    "scale": row["scale"],
                    "rotation": row["rotation"],
                    "z_index": row["z_index"],
                    "category": row["category"],
                    "image": row["front_path"]
                    or f"garments/{row['garment_id']}/thumb.webp",
                }
            )

        for outfit in outfits:
            items = grouped.get(outfit["id"], [])
            outfit["items"] = items
            outfit["item_count"] = len(items)
            outfit["cover"] = (
                f"garments/{items[0]['garment_id']}/thumb.webp" if items else None
            )
            outfit["categories"] = sorted({item["category"] for item in items})
        return outfits
    except sqlite3.Error as exc:
        logger.exception("查询搭配列表失败")
        raise ServiceError("读取搭配失败，请重试") from exc
    finally:
        conn.close()


def get_outfit(outfit_id: int) -> dict:
    """搭配详情，含平铺与上身两种视图的单品。"""
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM outfits WHERE id = ?", (outfit_id,)).fetchone()
        if row is None:
            raise NotFoundError("搭配不存在或已被删除")
        outfit = row_to_dict(row)

        items = conn.execute(
            "SELECT oi.*, g.name AS garment_name, g.category AS garment_category, "
            "gi.path AS front_path "
            "FROM outfit_items oi "
            "JOIN garments g ON g.id = oi.garment_id "
            "LEFT JOIN garment_images gi "
            "  ON gi.garment_id = g.id AND gi.angle = 'front' "
            "WHERE oi.outfit_id = ? "
            "ORDER BY oi.view, oi.z_index, oi.id",
            (outfit_id,),
        ).fetchall()

        grouped: dict[str, list[dict]] = {"flat": [], "worn": []}
        for item in items:
            data = dict(item)
            front = data.pop("front_path")
            data["garment"] = {
                "name": data.pop("garment_name"),
                "category": data.pop("garment_category"),
                "thumb": f"garments/{data['garment_id']}/thumb.webp",
                "image": front or f"garments/{data['garment_id']}/thumb.webp",
                "front": bool(front),
            }
            grouped.setdefault(data["view"], []).append(data)

        outfit["items"] = grouped
        return outfit
    except sqlite3.Error as exc:
        logger.exception("读取搭配失败 id=%s", outfit_id)
        raise ServiceError("读取搭配失败，请重试") from exc
    finally:
        conn.close()


# ---------------------------------------------------------------- 写入


def create_outfit(data: dict) -> dict:
    """新建搭配。"""
    meta = _validate_meta(data)
    now = now_str()

    conn = get_conn()
    try:
        with conn:
            cursor = conn.execute(
                "INSERT INTO outfits (name, scenes, notes, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (meta["name"], dump_list(meta["scenes"]), meta["notes"], now, now),
            )
            outfit_id = cursor.lastrowid
    except sqlite3.Error as exc:
        logger.exception("创建搭配失败")
        raise ServiceError("新建搭配失败，请重试") from exc
    finally:
        conn.close()

    logger.info("已创建搭配 id=%s name=%s", outfit_id, meta["name"])
    return get_outfit(outfit_id)


def update_outfit(outfit_id: int, data: dict) -> dict:
    """修改搭配名称、场景与备注。"""
    meta = _validate_meta(data)

    conn = get_conn()
    try:
        with conn:
            cursor = conn.execute(
                "UPDATE outfits SET name = ?, scenes = ?, notes = ?, updated_at = ? "
                "WHERE id = ?",
                (
                    meta["name"],
                    dump_list(meta["scenes"]),
                    meta["notes"],
                    now_precise(),
                    outfit_id,
                ),
            )
            if cursor.rowcount == 0:
                raise NotFoundError("搭配不存在或已被删除")
    except sqlite3.Error as exc:
        logger.exception("更新搭配失败 id=%s", outfit_id)
        raise ServiceError("保存搭配失败，请重试") from exc
    finally:
        conn.close()

    return get_outfit(outfit_id)


def delete_outfit(outfit_id: int) -> None:
    """删除搭配（画布条目由外键级联删除）。"""
    conn = get_conn()
    try:
        with conn:
            cursor = conn.execute("DELETE FROM outfits WHERE id = ?", (outfit_id,))
            deleted = cursor.rowcount
    except sqlite3.Error as exc:
        logger.exception("删除搭配失败 id=%s", outfit_id)
        raise ServiceError("删除失败，请重试") from exc
    finally:
        conn.close()

    if not deleted:
        raise NotFoundError("搭配不存在或已被删除")
    logger.info("已删除搭配 id=%s", outfit_id)


def _validate_items(raw_items: list) -> list[tuple]:
    """校验并整理画布条目。"""
    if not isinstance(raw_items, list):
        raise ValidationError("搭配数据格式不正确")
    if len(raw_items) > MAX_ITEMS:
        raise ValidationError(f"一套搭配最多 {MAX_ITEMS} 件")

    prepared = []
    for item in raw_items:
        if not isinstance(item, dict):
            raise ValidationError("搭配数据格式不正确")
        try:
            garment_id = int(item.get("garment_id"))
            x = float(item.get("x"))
            y = float(item.get("y"))
            scale = float(item.get("scale", 1))
            rotation = float(item.get("rotation", 0))
            z_index = int(item.get("z_index", 0))
            locked = 1 if item.get("locked") else 0
        except (TypeError, ValueError) as exc:
            raise ValidationError("搭配数据格式不正确") from exc

        if garment_id <= 0:
            raise ValidationError("搭配里有无效的衣服")

        prepared.append(
            (
                garment_id,
                min(1.0, max(0.0, x)),
                min(1.0, max(0.0, y)),
                min(5.0, max(0.1, scale)),
                min(180.0, max(-180.0, rotation)),
                min(999, max(0, z_index)),
                locked,
            )
        )
    return prepared


def save_items(outfit_id: int, view: str, raw_items: list) -> dict:
    """整体替换某个视图的画布布局。"""
    if view not in VIEWS:
        raise ValidationError("未知的视图")
    prepared = _validate_items(raw_items)

    conn = get_conn()
    try:
        with conn:
            exists = conn.execute(
                "SELECT 1 FROM outfits WHERE id = ?", (outfit_id,)
            ).fetchone()
            if exists is None:
                raise NotFoundError("搭配不存在或已被删除")

            conn.execute(
                "DELETE FROM outfit_items WHERE outfit_id = ? AND view = ?",
                (outfit_id, view),
            )
            conn.executemany(
                "INSERT INTO outfit_items "
                "(outfit_id, garment_id, view, x, y, scale, rotation, z_index, locked) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    (outfit_id, garment_id, view, x, y, scale, rotation, z_index, locked)
                    for (garment_id, x, y, scale, rotation, z_index, locked) in prepared
                ],
            )
            conn.execute(
                "UPDATE outfits SET updated_at = ? WHERE id = ?",
                (now_precise(), outfit_id),
            )
    except sqlite3.IntegrityError as exc:
        raise ValidationError("有待删除的衣服，请刷新后重试") from exc
    except sqlite3.Error as exc:
        logger.exception("保存搭配布局失败 id=%s view=%s", outfit_id, view)
        raise ServiceError("保存搭配失败，请重试") from exc
    finally:
        conn.close()

    return get_outfit(outfit_id)
