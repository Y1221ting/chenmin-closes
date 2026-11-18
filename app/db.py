"""SQLite 连接、建表与迁移。

约定：
- 每次操作独立连接，用完即关
- 开启外键约束，删除衣服时自动清理搭配条目
- 列表字段（seasons/occasions/scenes）以 JSON 字符串存储
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from .config import DB_PATH
from .utils import logger

SCHEMA_VERSION = 1

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS garments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    category      TEXT    NOT NULL,
    color         TEXT,
    seasons       TEXT,
    occasions     TEXT,
    brand         TEXT,
    price         REAL,
    purchase_date TEXT,
    notes         TEXT,
    wear_count    INTEGER NOT NULL DEFAULT 0,
    last_worn     TEXT,
    created_at    TEXT    NOT NULL,
    updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS garment_images (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    garment_id INTEGER NOT NULL,
    angle      TEXT    NOT NULL,
    path       TEXT    NOT NULL,
    width      INTEGER,
    height     INTEGER,
    FOREIGN KEY (garment_id) REFERENCES garments(id) ON DELETE CASCADE,
    UNIQUE (garment_id, angle)
);

CREATE TABLE IF NOT EXISTS outfits (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    scenes     TEXT,
    notes      TEXT,
    created_at TEXT    NOT NULL,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS outfit_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    outfit_id  INTEGER NOT NULL,
    garment_id INTEGER NOT NULL,
    view       TEXT    NOT NULL,
    x          REAL    NOT NULL,
    y          REAL    NOT NULL,
    scale      REAL    NOT NULL DEFAULT 1.0,
    rotation   REAL    NOT NULL DEFAULT 0,
    z_index    INTEGER NOT NULL DEFAULT 0,
    locked     INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (outfit_id) REFERENCES outfits(id) ON DELETE CASCADE,
    FOREIGN KEY (garment_id) REFERENCES garments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scenes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    builtin    INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_garments_category ON garments(category);
CREATE INDEX IF NOT EXISTS idx_images_garment    ON garment_images(garment_id);
CREATE INDEX IF NOT EXISTS idx_items_outfit_view ON outfit_items(outfit_id, view);
"""

BUILTIN_SCENES = [
    ("日常", 1),
    ("社交", 2),
    ("休闲", 3),
    ("正式", 4),
]


def get_conn() -> sqlite3.Connection:
    """打开一个带外键约束的连接。"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


@contextmanager
def transaction() -> Iterator[sqlite3.Connection]:
    """事务上下文：正常退出提交，异常回滚，最后关闭连接。"""
    conn = get_conn()
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def init_db() -> None:
    """建表并写入初始场景标签（幂等）。"""
    conn = get_conn()
    try:
        with conn:
            conn.executescript(SCHEMA_SQL)
            version = conn.execute("PRAGMA user_version").fetchone()[0]
            if version < SCHEMA_VERSION:
                conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
                logger.info("数据库结构已初始化到 v%s", SCHEMA_VERSION)

            for name, order in BUILTIN_SCENES:
                conn.execute(
                    "INSERT OR IGNORE INTO scenes (name, builtin, sort_order) VALUES (?, 1, ?)",
                    (name, order),
                )
    except sqlite3.Error:
        logger.exception("数据库初始化失败")
        raise
    finally:
        conn.close()
