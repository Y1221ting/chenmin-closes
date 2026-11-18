"""衣服相关接口：列表、详情、新建、修改、删除、上传角度图。"""

from __future__ import annotations

from ..config import ANGLE_LABELS
from ..errors import ValidationError
from ..router import Request
from ..services import garment_service


def _garment_id(req: Request) -> int:
    """从路径参数取衣服编号。"""
    try:
        return int(req.params.get("id", ""))
    except ValueError as exc:
        raise ValidationError("衣服编号不正确") from exc


def list_garments(req: Request) -> tuple[int, dict]:
    return 200, {"ok": True, "data": garment_service.list_garments(req.query)}


def create_garment(req: Request) -> tuple[int, dict]:
    return 200, {"ok": True, "data": garment_service.create_garment(req.json())}


def get_garment(req: Request) -> tuple[int, dict]:
    return 200, {"ok": True, "data": garment_service.get_garment(_garment_id(req))}


def update_garment(req: Request) -> tuple[int, dict]:
    data = garment_service.update_garment(_garment_id(req), req.json())
    return 200, {"ok": True, "data": data}


def delete_garment(req: Request) -> tuple[int, dict]:
    garment_service.delete_garment(_garment_id(req))
    return 200, {"ok": True, "data": {"deleted": True}}


def upload_image(req: Request) -> tuple[int, dict]:
    angle = (req.query.get("angle") or "").strip()
    if angle not in ANGLE_LABELS:
        raise ValidationError("请指定图片角度（front / side / back）")
    data = garment_service.save_image(_garment_id(req), angle, req.body)
    return 200, {"ok": True, "data": data}
