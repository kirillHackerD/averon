import sys
import os
import sqlite3
import hashlib
import uuid
from datetime import datetime, timedelta

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QTabWidget, QTableWidget, QTableWidgetItem, QLabel, QPushButton,
    QLineEdit, QDialog, QFormLayout, QMessageBox, QSplitter,
    QTextEdit, QComboBox, QDateEdit, QHeaderView, QFrame,
    QAbstractItemView, QStatusBar, QToolBar, QAction, QSizePolicy,
    QTreeWidget, QTreeWidgetItem, QGroupBox, QScrollArea, QMenu,
    QSpinBox, QCheckBox, QInputDialog,
)
from PyQt5.QtCore import (
    Qt, QThread, pyqtSignal, QDate, QTimer, QSortFilterProxyModel,
    QSize,
)
from PyQt5.QtGui import (
    QFont, QColor, QPalette, QIcon, QBrush, QPixmap, QPainter,
)

# ── DB path ──────────────────────────────────────────────────────────────────
DEFAULT_DB = os.path.join(os.path.dirname(__file__), "averon.db")
if "--db" in sys.argv:
    idx = sys.argv.index("--db")
    DB_PATH = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else DEFAULT_DB
else:
    DB_PATH = DEFAULT_DB


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def hash_pw(p: str) -> str:
    salt = b"averon_static_salt_v1"
    return hashlib.pbkdf2_hmac("sha256", p.encode(), salt, 260000).hex()


def fmt_dt(s):
    if not s:
        return "—"
    try:
        dt = datetime.fromisoformat(str(s))
        return dt.strftime("%d.%m.%Y %H:%M")
    except Exception:
        return str(s)


# ── Dark palette ──────────────────────────────────────────────────────────────

DARK_QSS = """
QMainWindow, QDialog, QWidget {
    background: #1a1814;
    color: #e2dcd6;
    font-family: 'Inter', 'Segoe UI', sans-serif;
    font-size: 13px;
}
QTabWidget::pane {
    border: 1px solid #2a2724;
    background: #1e1c1a;
}
QTabBar::tab {
    background: #252220;
    color: #9e968e;
    padding: 8px 20px;
    border: 1px solid #2a2724;
    border-bottom: none;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    min-width: 100px;
}
QTabBar::tab:selected {
    background: #1e1c1a;
    color: #e2dcd6;
    border-bottom: 2px solid #c97a5a;
}
QTabBar::tab:hover:!selected {
    background: #2c2926;
    color: #e2dcd6;
}
QTableWidget {
    background: #1e1c1a;
    alternate-background-color: #252220;
    color: #e2dcd6;
    gridline-color: #2a2724;
    border: 1px solid #2a2724;
    border-radius: 6px;
    selection-background-color: #3a2f28;
    selection-color: #e2dcd6;
}
QTableWidget::item {
    padding: 4px 8px;
    border: none;
}
QHeaderView::section {
    background: #252220;
    color: #9e968e;
    padding: 6px 8px;
    border: none;
    border-right: 1px solid #2a2724;
    border-bottom: 1px solid #2a2724;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
QPushButton {
    background: #252220;
    color: #e2dcd6;
    border: 1px solid #2a2724;
    border-radius: 6px;
    padding: 7px 16px;
    font-size: 13px;
}
QPushButton:hover {
    background: #2c2926;
    border-color: #353129;
}
QPushButton:pressed {
    background: #333027;
}
QPushButton.primary {
    background: #c97a5a;
    color: #fff;
    border: none;
}
QPushButton.primary:hover {
    background: #b5663f;
}
QPushButton.danger {
    background: transparent;
    color: #f87171;
    border-color: rgba(248,113,113,0.3);
}
QPushButton.danger:hover {
    background: rgba(248,113,113,0.1);
}
QPushButton.success {
    background: transparent;
    color: #4ade80;
    border-color: rgba(74,222,128,0.3);
}
QPushButton.success:hover {
    background: rgba(74,222,128,0.1);
}
QLineEdit, QTextEdit, QComboBox, QSpinBox, QDateEdit {
    background: #252220;
    color: #e2dcd6;
    border: 1px solid #2a2724;
    border-radius: 6px;
    padding: 7px 10px;
    font-size: 13px;
    selection-background-color: #c97a5a;
}
QLineEdit:focus, QTextEdit:focus, QComboBox:focus, QSpinBox:focus, QDateEdit:focus {
    border-color: #c97a5a;
    background: #2c2926;
}
QComboBox::drop-down {
    border: none;
    width: 20px;
}
QComboBox QAbstractItemView {
    background: #252220;
    color: #e2dcd6;
    border: 1px solid #2a2724;
    selection-background-color: #3a2f28;
}
QLabel {
    color: #e2dcd6;
}
QLabel.muted {
    color: #9e968e;
    font-size: 12px;
}
QLabel.accent {
    color: #c97a5a;
    font-weight: 600;
}
QGroupBox {
    color: #9e968e;
    border: 1px solid #2a2724;
    border-radius: 8px;
    margin-top: 12px;
    padding-top: 8px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
QGroupBox::title {
    subcontrol-origin: margin;
    left: 12px;
    padding: 0 6px;
    background: #1a1814;
}
QSplitter::handle {
    background: #2a2724;
    width: 1px;
    height: 1px;
}
QScrollBar:vertical {
    background: transparent;
    width: 6px;
    margin: 0;
}
QScrollBar::handle:vertical {
    background: #2c2926;
    border-radius: 3px;
    min-height: 30px;
}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0; }
QScrollBar:horizontal {
    background: transparent;
    height: 6px;
}
QScrollBar::handle:horizontal {
    background: #2c2926;
    border-radius: 3px;
}
QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal { width: 0; }
QStatusBar {
    background: #141210;
    color: #5c5650;
    border-top: 1px solid #2a2724;
    font-size: 11px;
}
QToolBar {
    background: #141210;
    border-bottom: 1px solid #2a2724;
    spacing: 4px;
    padding: 4px 8px;
}
QMenu {
    background: #252220;
    color: #e2dcd6;
    border: 1px solid #2a2724;
    border-radius: 8px;
    padding: 4px;
}
QMenu::item {
    padding: 7px 14px;
    border-radius: 5px;
}
QMenu::item:selected {
    background: #2c2926;
}
QMenu::separator {
    height: 1px;
    background: #2a2724;
    margin: 3px 8px;
}
QTreeWidget {
    background: #1e1c1a;
    alternate-background-color: #252220;
    color: #e2dcd6;
    border: 1px solid #2a2724;
    border-radius: 6px;
}
QTreeWidget::item {
    padding: 3px 4px;
}
QTreeWidget::item:selected {
    background: #3a2f28;
}
QCheckBox {
    color: #e2dcd6;
    spacing: 8px;
}
QCheckBox::indicator {
    width: 16px; height: 16px;
    border: 1px solid #2a2724;
    border-radius: 4px;
    background: #252220;
}
QCheckBox::indicator:checked {
    background: #c97a5a;
    border-color: #c97a5a;
}
"""

BADGE_SUB = "background:#4ade8022;color:#4ade80;border:1px solid #4ade8044;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:600;"
BADGE_FREE = "background:#9e968e22;color:#9e968e;border:1px solid #9e968e44;border-radius:4px;padding:2px 7px;font-size:11px;"
BADGE_LIKE = "background:#c97a5a22;color:#c97a5a;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:600;"
BADGE_DISLIKE = "background:#f8717122;color:#f87171;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:600;"


# ═══════════════════════════════════════════════════════════════════════════════
#  DIALOGS
# ═══════════════════════════════════════════════════════════════════════════════

class ChangePasswordDialog(QDialog):
    def __init__(self, user, parent=None):
        super().__init__(parent)
        self.user = user
        self.setWindowTitle(f"Сменить пароль — {user['username']}")
        self.setMinimumWidth(360)
        self._build()

    def _build(self):
        lay = QVBoxLayout(self)
        lay.setSpacing(12)

        info = QLabel(f"Пользователь: <b>{self.user['username']}</b>  ({self.user['email']})")
        info.setTextFormat(Qt.RichText)
        lay.addWidget(info)

        form = QFormLayout()
        form.setSpacing(10)
        self.pw_edit = QLineEdit()
        self.pw_edit.setPlaceholderText("Новый пароль")
        self.pw_edit.setEchoMode(QLineEdit.Password)
        self.pw2_edit = QLineEdit()
        self.pw2_edit.setPlaceholderText("Повтор пароля")
        self.pw2_edit.setEchoMode(QLineEdit.Password)
        form.addRow("Новый пароль:", self.pw_edit)
        form.addRow("Повтор:", self.pw2_edit)
        lay.addLayout(form)

        row = QHBoxLayout()
        cancel_btn = QPushButton("Отмена")
        cancel_btn.clicked.connect(self.reject)
        save_btn = QPushButton("Сохранить")
        save_btn.setProperty("class", "primary")
        save_btn.setStyleSheet("background:#c97a5a;color:#fff;border:none;")
        save_btn.clicked.connect(self._save)
        row.addWidget(cancel_btn)
        row.addWidget(save_btn)
        lay.addLayout(row)

    def _save(self):
        pw = self.pw_edit.text().strip()
        pw2 = self.pw2_edit.text().strip()
        if not pw:
            QMessageBox.warning(self, "Ошибка", "Пароль не может быть пустым")
            return
        if pw != pw2:
            QMessageBox.warning(self, "Ошибка", "Пароли не совпадают")
            return
        if len(pw) < 4:
            QMessageBox.warning(self, "Ошибка", "Минимум 4 символа")
            return
        try:
            conn = get_db()
            conn.execute("UPDATE users SET password=? WHERE id=?",
                         (hash_pw(pw), self.user['id']))
            conn.commit()
            conn.close()
            QMessageBox.information(self, "Готово", "Пароль обновлён")
            self.accept()
        except Exception as e:
            QMessageBox.critical(self, "Ошибка БД", str(e))


class SubscriptionDialog(QDialog):
    def __init__(self, user, parent=None):
        super().__init__(parent)
        self.user = user
        self.setWindowTitle(f"Подписка — {user['username']}")
        self.setMinimumWidth(380)
        self._build()

    def _build(self):
        lay = QVBoxLayout(self)
        lay.setSpacing(12)

        info = QLabel(f"Пользователь: <b>{self.user['username']}</b>")
        info.setTextFormat(Qt.RichText)
        lay.addWidget(info)

        # Current subscription
        conn = get_db()
        sub = conn.execute("SELECT * FROM subscriptions WHERE user_id=?",
                           (self.user['id'],)).fetchone()
        conn.close()

        self.sub = dict(sub) if sub else None
        if self.sub:
            exp = fmt_dt(self.sub.get('expires_at'))
            status_lbl = QLabel(f"Текущая подписка: <span style='color:#4ade80;'>Pro</span>  •  до {exp}")
        else:
            status_lbl = QLabel("Текущая подписка: <span style='color:#9e968e;'>Free</span>")
        status_lbl.setTextFormat(Qt.RichText)
        lay.addWidget(status_lbl)

        grp = QGroupBox("Выдать / продлить подписку")
        grp_lay = QFormLayout(grp)
        grp_lay.setSpacing(10)

        self.plan_combo = QComboBox()
        self.plan_combo.addItems(["pro", "basic"])
        grp_lay.addRow("Тариф:", self.plan_combo)

        self.days_spin = QSpinBox()
        self.days_spin.setRange(1, 3650)
        self.days_spin.setValue(30)
        self.days_spin.setSuffix(" дней")
        grp_lay.addRow("Длительность:", self.days_spin)

        self.from_now_chk = QCheckBox("Отсчитывать от сегодня (не продлевать)")
        self.from_now_chk.setChecked(True)
        grp_lay.addRow("", self.from_now_chk)

        lay.addWidget(grp)

        row = QHBoxLayout()
        if self.sub:
            revoke_btn = QPushButton("Отозвать подписку")
            revoke_btn.setStyleSheet("color:#f87171;border-color:rgba(248,113,113,0.3);")
            revoke_btn.clicked.connect(self._revoke)
            row.addWidget(revoke_btn)
        cancel_btn = QPushButton("Отмена")
        cancel_btn.clicked.connect(self.reject)
        save_btn = QPushButton("Выдать")
        save_btn.setStyleSheet("background:#c97a5a;color:#fff;border:none;")
        save_btn.clicked.connect(self._grant)
        row.addWidget(cancel_btn)
        row.addWidget(save_btn)
        lay.addLayout(row)

    def _grant(self):
        days = self.days_spin.value()
        plan = self.plan_combo.currentText()
        if self.from_now_chk.isChecked() or not self.sub:
            base = datetime.utcnow()
        else:
            try:
                base = datetime.fromisoformat(str(self.sub['expires_at']))
                if base < datetime.utcnow():
                    base = datetime.utcnow()
            except Exception:
                base = datetime.utcnow()
        expires = (base + timedelta(days=days)).isoformat()
        try:
            conn = get_db()
            conn.execute("""
                INSERT INTO subscriptions (id, user_id, plan, expires_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan, expires_at=excluded.expires_at
            """, (str(uuid.uuid4()), self.user['id'], plan, expires))
            conn.commit()
            conn.close()
            QMessageBox.information(self, "Готово",
                                    f"Подписка {plan} до {fmt_dt(expires)}")
            self.accept()
        except Exception as e:
            QMessageBox.critical(self, "Ошибка", str(e))

    def _revoke(self):
        r = QMessageBox.question(self, "Подтверждение",
                                 "Отозвать подписку?",
                                 QMessageBox.Yes | QMessageBox.No)
        if r != QMessageBox.Yes:
            return
        try:
            conn = get_db()
            conn.execute("DELETE FROM subscriptions WHERE user_id=?",
                         (self.user['id'],))
            conn.commit()
            conn.close()
            QMessageBox.information(self, "Готово", "Подписка отозвана")
            self.accept()
        except Exception as e:
            QMessageBox.critical(self, "Ошибка", str(e))


class UserEditDialog(QDialog):
    def __init__(self, user, parent=None):
        super().__init__(parent)
        self.user = user
        self.setWindowTitle(f"Редактировать — {user['username']}")
        self.setMinimumWidth(380)
        self._build()

    def _build(self):
        lay = QVBoxLayout(self)
        lay.setSpacing(12)

        form = QFormLayout()
        form.setSpacing(10)

        self.username_edit = QLineEdit(self.user.get('username', ''))
        self.email_edit = QLineEdit(self.user.get('email', ''))

        form.addRow("Имя пользователя:", self.username_edit)
        form.addRow("Email:", self.email_edit)
        lay.addLayout(form)

        row = QHBoxLayout()
        cancel_btn = QPushButton("Отмена")
        cancel_btn.clicked.connect(self.reject)
        save_btn = QPushButton("Сохранить")
        save_btn.setStyleSheet("background:#c97a5a;color:#fff;border:none;")
        save_btn.clicked.connect(self._save)
        row.addWidget(cancel_btn)
        row.addWidget(save_btn)
        lay.addLayout(row)

    def _save(self):
        username = self.username_edit.text().strip()
        email = self.email_edit.text().strip()
        if not username or not email:
            QMessageBox.warning(self, "Ошибка", "Заполните все поля")
            return
        try:
            conn = get_db()
            conn.execute("UPDATE users SET username=?, email=? WHERE id=?",
                         (username, email, self.user['id']))
            conn.commit()
            conn.close()
            QMessageBox.information(self, "Готово", "Данные обновлены")
            self.accept()
        except sqlite3.IntegrityError:
            QMessageBox.warning(self, "Ошибка",
                                "Имя пользователя или email уже заняты")
        except Exception as e:
            QMessageBox.critical(self, "Ошибка", str(e))


class ChatMessagesDialog(QDialog):
    """Просмотр сообщений конкретного чата."""

    def __init__(self, chat, parent=None):
        super().__init__(parent)
        self.chat = chat
        self.setWindowTitle(f"Чат: {chat.get('title', 'Без названия')}")
        self.resize(720, 560)
        self._build()
        self._load()

    def _build(self):
        lay = QVBoxLayout(self)
        lay.setSpacing(8)

        header = QLabel(
            f"<b>{self.chat.get('title', '—')}</b>  "
            f"<span style='color:#9e968e;font-size:11px;'>Модель: {self.chat.get('model','—')}  •  "
            f"{fmt_dt(self.chat.get('created_at'))}</span>"
        )
        header.setTextFormat(Qt.RichText)
        lay.addWidget(header)

        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll.setFrameShape(QFrame.NoFrame)
        self.inner = QWidget()
        self.msgs_lay = QVBoxLayout(self.inner)
        self.msgs_lay.setSpacing(10)
        self.msgs_lay.addStretch()
        self.scroll.setWidget(self.inner)
        lay.addWidget(self.scroll)

        close_btn = QPushButton("Закрыть")
        close_btn.clicked.connect(self.accept)
        lay.addWidget(close_btn, alignment=Qt.AlignRight)

    def _load(self):
        conn = get_db()
        rows = conn.execute(
            "SELECT * FROM messages WHERE chat_id=? ORDER BY created_at ASC",
            (self.chat['id'],)
        ).fetchall()
        conn.close()

        # clear
        while self.msgs_lay.count() > 1:
            item = self.msgs_lay.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        for row in rows:
            self._add_bubble(dict(row))

        # scroll to bottom
        QTimer.singleShot(50, lambda: self.scroll.verticalScrollBar().setValue(
            self.scroll.verticalScrollBar().maximum()))

    def _add_bubble(self, msg):
        is_user = msg['role'] == 'user'
        outer = QHBoxLayout()
        outer.setContentsMargins(0, 0, 0, 0)

        bubble = QFrame()
        bubble.setMaximumWidth(580)
        b_lay = QVBoxLayout(bubble)
        b_lay.setContentsMargins(12, 8, 12, 8)
        b_lay.setSpacing(4)

        role_lbl = QLabel("Вы" if is_user else "Averon AI")
        role_lbl.setStyleSheet("font-size:11px;font-weight:600;color:#9e968e;")
        b_lay.addWidget(role_lbl)

        content = msg.get('content', '')
        if len(content) > 1200:
            content = content[:1200] + "\n… (сокращено)"
        text_lbl = QLabel(content)
        text_lbl.setWordWrap(True)
        text_lbl.setTextInteractionFlags(Qt.TextSelectableByMouse)
        text_lbl.setStyleSheet("font-size:13px;line-height:1.5;")
        b_lay.addWidget(text_lbl)

        time_lbl = QLabel(fmt_dt(msg.get('created_at')))
        time_lbl.setStyleSheet("font-size:10px;color:#5c5650;")
        b_lay.addWidget(time_lbl)

        if is_user:
            bubble.setStyleSheet(
                "background:#2a2420;border:1px solid #3a2f28;"
                "border-radius:12px 4px 12px 12px;"
            )
            outer.addStretch()
            outer.addWidget(bubble)
        else:
            bubble.setStyleSheet(
                "background:#252220;border:1px solid #2a2724;"
                "border-radius:4px 12px 12px 12px;"
            )
            outer.addWidget(bubble)
            outer.addStretch()

        wrapper = QWidget()
        wrapper.setLayout(outer)
        self.msgs_lay.insertWidget(self.msgs_lay.count() - 1, wrapper)


# ═══════════════════════════════════════════════════════════════════════════════
#  USERS TAB
# ═══════════════════════════════════════════════════════════════════════════════

class UsersTab(QWidget):
    status_msg = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._build()
        self.refresh()

    def _build(self):
        lay = QVBoxLayout(self)
        lay.setContentsMargins(12, 12, 12, 12)
        lay.setSpacing(8)

        # ── toolbar ──
        tb = QHBoxLayout()
        self.search_edit = QLineEdit()
        self.search_edit.setPlaceholderText("🔍  Поиск по имени / email…")
        self.search_edit.setMaximumWidth(300)
        self.search_edit.textChanged.connect(self._filter)

        refresh_btn = QPushButton("⟳  Обновить")
        refresh_btn.clicked.connect(self.refresh)

        self.stats_lbl = QLabel()
        self.stats_lbl.setStyleSheet("color:#9e968e;font-size:12px;")

        tb.addWidget(self.search_edit)
        tb.addWidget(refresh_btn)
        tb.addStretch()
        tb.addWidget(self.stats_lbl)
        lay.addLayout(tb)

        # ── splitter: table + detail ──
        splitter = QSplitter(Qt.Horizontal)

        # Table
        self.table = QTableWidget()
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels([
            "Имя", "Email", "Подписка", "До", "Чатов", "Сообщений", "Зарегистрирован"
        ])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Interactive)
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().setVisible(False)
        self.table.setContextMenuPolicy(Qt.CustomContextMenu)
        self.table.customContextMenuRequested.connect(self._ctx_menu)
        self.table.selectionModel().selectionChanged.connect(self._on_select)
        self.table.setColumnWidth(0, 130)
        self.table.setColumnWidth(1, 180)
        self.table.setColumnWidth(2, 90)
        self.table.setColumnWidth(3, 120)
        self.table.setColumnWidth(4, 60)
        self.table.setColumnWidth(5, 80)
        splitter.addWidget(self.table)

        # Detail panel
        detail = QWidget()
        detail.setMinimumWidth(240)
        detail.setMaximumWidth(300)
        d_lay = QVBoxLayout(detail)
        d_lay.setContentsMargins(8, 0, 0, 0)
        d_lay.setSpacing(8)

        self.detail_name = QLabel("—")
        self.detail_name.setStyleSheet("font-size:16px;font-weight:600;color:#e2dcd6;")
        self.detail_email = QLabel("—")
        self.detail_email.setStyleSheet("color:#9e968e;font-size:12px;")
        self.detail_sub_badge = QLabel("Free")
        self.detail_sub_badge.setStyleSheet(BADGE_FREE)
        self.detail_sub_badge.setFixedHeight(22)
        self.detail_reg = QLabel("—")
        self.detail_reg.setStyleSheet("color:#9e968e;font-size:12px;")

        d_lay.addWidget(self.detail_name)
        d_lay.addWidget(self.detail_email)
        d_lay.addWidget(self.detail_sub_badge)
        d_lay.addWidget(self.detail_reg)

        sep = QFrame()
        sep.setFrameShape(QFrame.HLine)
        sep.setStyleSheet("border:none;border-top:1px solid #2a2724;margin:4px 0;")
        d_lay.addWidget(sep)

        # action buttons
        for label, slot, style in [
            ("✏️  Редактировать", self._edit_user, ""),
            ("🔑  Сменить пароль", self._change_pw, ""),
            ("⭐  Управление подпиской", self._manage_sub, ""),
            ("💬  Чаты пользователя", self._open_chats, ""),
            ("🗑️  Удалить пользователя", self._delete_user,
             "color:#f87171;border-color:rgba(248,113,113,0.3);"),
        ]:
            btn = QPushButton(label)
            if style:
                btn.setStyleSheet(btn.styleSheet() + style)
            btn.clicked.connect(slot)
            d_lay.addWidget(btn)

        d_lay.addStretch()
        splitter.addWidget(detail)
        splitter.setStretchFactor(0, 3)
        splitter.setStretchFactor(1, 1)
        lay.addWidget(splitter)

        self._users = []

    # ── data ──

    def refresh(self):
        conn = get_db()
        users = conn.execute("""
            SELECT u.*,
                   s.plan, s.expires_at,
                   COUNT(DISTINCT c.id) AS chat_count,
                   COUNT(DISTINCT m.id) AS msg_count
            FROM users u
            LEFT JOIN subscriptions s ON s.user_id = u.id
            LEFT JOIN chats c ON c.user_id = u.id
            LEFT JOIN messages m ON m.chat_id = c.id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        """).fetchall()
        conn.close()
        self._users = [dict(u) for u in users]
        self._render(self._users)
        total = len(self._users)
        subs = sum(1 for u in self._users if u.get('plan'))
        self.stats_lbl.setText(
            f"Всего: {total}  •  Подписчиков: {subs}  •  Free: {total - subs}"
        )

    def _render(self, users):
        self.table.setRowCount(0)
        for row_data in users:
            r = self.table.rowCount()
            self.table.insertRow(r)

            name_item = QTableWidgetItem(row_data.get('username', ''))
            name_item.setData(Qt.UserRole, row_data)
            self.table.setItem(r, 0, name_item)
            self.table.setItem(r, 1, QTableWidgetItem(row_data.get('email', '')))

            # subscription badge
            plan = row_data.get('plan')
            if plan:
                sub_item = QTableWidgetItem("Pro")
                sub_item.setForeground(QBrush(QColor("#4ade80")))
                sub_item.setFont(QFont("", -1, QFont.Bold))
            else:
                sub_item = QTableWidgetItem("Free")
                sub_item.setForeground(QBrush(QColor("#9e968e")))
            self.table.setItem(r, 2, sub_item)

            exp = fmt_dt(row_data.get('expires_at')) if plan else "—"
            self.table.setItem(r, 3, QTableWidgetItem(exp))
            self.table.setItem(r, 4, QTableWidgetItem(str(row_data.get('chat_count', 0))))
            self.table.setItem(r, 5, QTableWidgetItem(str(row_data.get('msg_count', 0))))
            self.table.setItem(r, 6, QTableWidgetItem(fmt_dt(row_data.get('created_at'))))

        self.table.resizeRowsToContents()

    def _filter(self, text):
        text = text.lower()
        filtered = [u for u in self._users
                    if text in u.get('username', '').lower()
                    or text in u.get('email', '').lower()]
        self._render(filtered)

    def _selected_user(self):
        rows = self.table.selectedItems()
        if not rows:
            return None
        item = self.table.item(rows[0].row(), 0)
        return item.data(Qt.UserRole) if item else None

    def _on_select(self):
        u = self._selected_user()
        if not u:
            return
        self.detail_name.setText(u.get('username', '—'))
        self.detail_email.setText(u.get('email', '—'))
        if u.get('plan'):
            exp = fmt_dt(u.get('expires_at'))
            self.detail_sub_badge.setText(f"Pro  •  до {exp}")
            self.detail_sub_badge.setStyleSheet(BADGE_SUB)
        else:
            self.detail_sub_badge.setText("Free")
            self.detail_sub_badge.setStyleSheet(BADGE_FREE)
        self.detail_reg.setText(f"Зарег: {fmt_dt(u.get('created_at'))}")

    def _ctx_menu(self, pos):
        u = self._selected_user()
        if not u:
            return
        menu = QMenu(self)
        menu.addAction("✏️  Редактировать", self._edit_user)
        menu.addAction("🔑  Сменить пароль", self._change_pw)
        menu.addAction("⭐  Подписка", self._manage_sub)
        menu.addAction("💬  Чаты", self._open_chats)
        menu.addSeparator()
        menu.addAction("🗑️  Удалить", self._delete_user)
        menu.exec_(self.table.viewport().mapToGlobal(pos))

    # ── actions ──

    def _edit_user(self):
        u = self._selected_user()
        if not u:
            return
        dlg = UserEditDialog(u, self)
        if dlg.exec_() == QDialog.Accepted:
            self.refresh()
            self.status_msg.emit(f"Пользователь {u['username']} обновлён")

    def _change_pw(self):
        u = self._selected_user()
        if not u:
            return
        dlg = ChangePasswordDialog(u, self)
        if dlg.exec_() == QDialog.Accepted:
            self.status_msg.emit(f"Пароль {u['username']} изменён")

    def _manage_sub(self):
        u = self._selected_user()
        if not u:
            return
        dlg = SubscriptionDialog(u, self)
        if dlg.exec_() == QDialog.Accepted:
            self.refresh()
            self.status_msg.emit(f"Подписка {u['username']} обновлена")

    def _open_chats(self):
        u = self._selected_user()
        if not u:
            return
        dlg = UserChatsDialog(u, self)
        dlg.exec_()

    def _delete_user(self):
        u = self._selected_user()
        if not u:
            return
        r = QMessageBox.question(
            self, "Удалить пользователя?",
            f"Удалить <b>{u['username']}</b> и все его данные (чаты, память)?<br>"
            "<span style='color:#f87171;'>Это действие необратимо.</span>",
            QMessageBox.Yes | QMessageBox.No
        )
        if r != QMessageBox.Yes:
            return
        try:
            conn = get_db()
            conn.execute("DELETE FROM users WHERE id=?", (u['id'],))
            conn.commit()
            conn.close()
            self.refresh()
            self.status_msg.emit(f"Пользователь {u['username']} удалён")
        except Exception as e:
            QMessageBox.critical(self, "Ошибка", str(e))


# ═══════════════════════════════════════════════════════════════════════════════
#  USER CHATS DIALOG
# ═══════════════════════════════════════════════════════════════════════════════

class UserChatsDialog(QDialog):
    def __init__(self, user, parent=None):
        super().__init__(parent)
        self.user = user
        self.setWindowTitle(f"Чаты — {user['username']}")
        self.resize(860, 520)
        self._build()
        self._load()

    def _build(self):
        lay = QHBoxLayout(self)

        # Left: chat list
        left = QWidget()
        left.setMaximumWidth(320)
        l_lay = QVBoxLayout(left)
        l_lay.setContentsMargins(0, 0, 4, 0)

        header = QLabel(f"Чаты пользователя <b>{self.user['username']}</b>")
        header.setTextFormat(Qt.RichText)
        l_lay.addWidget(header)

        self.chat_list = QTableWidget()
        self.chat_list.setColumnCount(3)
        self.chat_list.setHorizontalHeaderLabels(["Название", "Модель", "Дата"])
        self.chat_list.horizontalHeader().setStretchLastSection(True)
        self.chat_list.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.chat_list.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.chat_list.verticalHeader().setVisible(False)
        self.chat_list.setColumnWidth(0, 140)
        self.chat_list.setColumnWidth(1, 60)
        self.chat_list.selectionModel().selectionChanged.connect(self._on_chat_select)
        l_lay.addWidget(self.chat_list)

        open_btn = QPushButton("Открыть чат")
        open_btn.setStyleSheet("background:#c97a5a;color:#fff;border:none;")
        open_btn.clicked.connect(self._open_chat)
        l_lay.addWidget(open_btn)

        lay.addWidget(left)

        # Right: messages preview
        right = QWidget()
        r_lay = QVBoxLayout(right)
        r_lay.setContentsMargins(4, 0, 0, 0)

        self.preview_lbl = QLabel("Выберите чат слева")
        self.preview_lbl.setStyleSheet("color:#9e968e;font-size:13px;")
        r_lay.addWidget(self.preview_lbl)

        self.msg_preview = QTextEdit()
        self.msg_preview.setReadOnly(True)
        self.msg_preview.setStyleSheet(
            "background:#1e1c1a;border:1px solid #2a2724;border-radius:8px;"
            "font-size:13px;padding:8px;"
        )
        r_lay.addWidget(self.msg_preview)

        lay.addWidget(right)

        self._chats = []

    def _load(self):
        conn = get_db()
        rows = conn.execute("""
            SELECT c.*, COUNT(m.id) as msg_count
            FROM chats c
            LEFT JOIN messages m ON m.chat_id = c.id
            WHERE c.user_id=?
            GROUP BY c.id
            ORDER BY c.updated_at DESC
        """, (self.user['id'],)).fetchall()
        conn.close()
        self._chats = [dict(r) for r in rows]
        self.chat_list.setRowCount(0)
        for chat in self._chats:
            r = self.chat_list.rowCount()
            self.chat_list.insertRow(r)
            item = QTableWidgetItem(chat.get('title', 'Новый чат'))
            item.setData(Qt.UserRole, chat)
            self.chat_list.setItem(r, 0, item)
            self.chat_list.setItem(r, 1, QTableWidgetItem(chat.get('model', '—')))
            self.chat_list.setItem(r, 2, QTableWidgetItem(fmt_dt(chat.get('created_at'))))
        self.chat_list.resizeRowsToContents()

    def _selected_chat(self):
        rows = self.chat_list.selectedItems()
        if not rows:
            return None
        return self.chat_list.item(rows[0].row(), 0).data(Qt.UserRole)

    def _on_chat_select(self):
        chat = self._selected_chat()
        if not chat:
            return
        self.preview_lbl.setText(
            f"<b>{chat.get('title','—')}</b>  "
            f"<span style='color:#9e968e;font-size:11px;'>"
            f"{chat.get('msg_count', 0)} сообщений  •  {fmt_dt(chat.get('created_at'))}"
            f"</span>"
        )
        self.preview_lbl.setTextFormat(Qt.RichText)
        # Load last 10 messages
        conn = get_db()
        msgs = conn.execute(
            "SELECT * FROM messages WHERE chat_id=? ORDER BY created_at ASC",
            (chat['id'],)
        ).fetchall()
        conn.close()
        html = ""
        for m in msgs:
            role = "Вы" if m['role'] == 'user' else "Averon"
            color = "#c97a5a" if m['role'] == 'user' else "#9e968e"
            content = (m['content'] or '')[:500]
            if len(m['content'] or '') > 500:
                content += "…"
            content = content.replace('<', '&lt;').replace('>', '&gt;')
            html += (
                f"<p style='margin:8px 0 2px;'>"
                f"<span style='color:{color};font-weight:600;font-size:11px;'>{role}</span>"
                f"  <span style='color:#5c5650;font-size:10px;'>{fmt_dt(m['created_at'])}</span>"
                f"</p>"
                f"<p style='margin:0 0 10px;color:#e2dcd6;font-size:13px;'>{content}</p>"
                f"<hr style='border:none;border-top:1px solid #2a2724;'>"
            )
        self.msg_preview.setHtml(html or "<p style='color:#9e968e;'>Нет сообщений</p>")

    def _open_chat(self):
        chat = self._selected_chat()
        if not chat:
            return
        dlg = ChatMessagesDialog(chat, self)
        dlg.exec_()


# ═══════════════════════════════════════════════════════════════════════════════
#  CHATS TAB
# ═══════════════════════════════════════════════════════════════════════════════

class ChatsTab(QWidget):
    status_msg = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._chats = []
        self._users = []
        self._selected_user_id = None
        self._build()
        self.refresh()

    def _build(self):
        lay = QVBoxLayout(self)
        lay.setContentsMargins(12, 12, 12, 12)
        lay.setSpacing(8)

        # ── toolbar ──
        tb = QHBoxLayout()
        tb.setSpacing(8)

        user_lbl = QLabel("Пользователь:")
        user_lbl.setStyleSheet("color:#9e968e;font-size:12px;")
        tb.addWidget(user_lbl)

        self.user_combo = QComboBox()
        self.user_combo.setMinimumWidth(220)
        self.user_combo.setMaximumWidth(300)
        self.user_combo.currentIndexChanged.connect(self._on_user_changed)
        tb.addWidget(self.user_combo)

        refresh_btn = QPushButton("⟳  Обновить")
        refresh_btn.clicked.connect(self.refresh)
        tb.addWidget(refresh_btn)

        tb.addStretch()

        self.stats_lbl = QLabel()
        self.stats_lbl.setStyleSheet("color:#9e968e;font-size:12px;")
        tb.addWidget(self.stats_lbl)

        lay.addLayout(tb)

        # ── splitter: table + user card ──
        splitter = QSplitter(Qt.Horizontal)

        # Chats table
        self.table = QTableWidget()
        self.table.setColumnCount(5)
        self.table.setHorizontalHeaderLabels([
            "Название", "Модель", "Сообщений", "Создан", "Обновлён"
        ])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Interactive)
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().setVisible(False)
        self.table.setContextMenuPolicy(Qt.CustomContextMenu)
        self.table.customContextMenuRequested.connect(self._ctx_menu)
        self.table.doubleClicked.connect(self._open_chat)
        self.table.setColumnWidth(0, 220)
        self.table.setColumnWidth(1, 90)
        self.table.setColumnWidth(2, 80)
        self.table.setColumnWidth(3, 140)
        splitter.addWidget(self.table)

        # User card
        self.card_widget = QWidget()
        self.card_widget.setMinimumWidth(240)
        self.card_widget.setMaximumWidth(300)
        card_lay = QVBoxLayout(self.card_widget)
        card_lay.setContentsMargins(10, 0, 0, 0)
        card_lay.setSpacing(0)

        # Placeholder shown when no user selected
        self.card_placeholder = QLabel("Выберите\nпользователя")
        self.card_placeholder.setAlignment(Qt.AlignCenter)
        self.card_placeholder.setStyleSheet(
            "color:#5c5650;font-size:13px;border:1px dashed #2a2724;"
            "border-radius:10px;padding:40px;"
        )
        card_lay.addWidget(self.card_placeholder)

        # Actual card (hidden until user selected)
        self.card_frame = QFrame()
        self.card_frame.setStyleSheet(
            "background:#252220;border:1px solid #2a2724;border-radius:10px;"
        )
        self.card_frame.hide()
        cf_lay = QVBoxLayout(self.card_frame)
        cf_lay.setContentsMargins(16, 16, 16, 16)
        cf_lay.setSpacing(10)

        # Avatar circle placeholder
        avatar_row = QHBoxLayout()
        self.card_avatar = QLabel("👤")
        self.card_avatar.setFixedSize(44, 44)
        self.card_avatar.setAlignment(Qt.AlignCenter)
        self.card_avatar.setStyleSheet(
            "background:#3a2f28;border-radius:22px;font-size:20px;"
            "border:none;"
        )
        avatar_row.addWidget(self.card_avatar)
        avatar_row.addStretch()

        self.card_sub_badge = QLabel("Free")
        self.card_sub_badge.setStyleSheet(BADGE_FREE)
        self.card_sub_badge.setFixedHeight(22)
        avatar_row.addWidget(self.card_sub_badge)
        cf_lay.addLayout(avatar_row)

        self.card_username = QLabel("—")
        self.card_username.setStyleSheet(
            "font-size:17px;font-weight:700;color:#e2dcd6;border:none;"
        )
        cf_lay.addWidget(self.card_username)

        sep1 = QFrame()
        sep1.setFrameShape(QFrame.HLine)
        sep1.setStyleSheet("border:none;border-top:1px solid #2a2724;margin:2px 0;")
        cf_lay.addWidget(sep1)

        # Fields grid
        def _field(label_text):
            outer = QVBoxLayout()
            outer.setSpacing(2)
            lbl = QLabel(label_text)
            lbl.setStyleSheet("color:#5c5650;font-size:10px;font-weight:600;"
                              "text-transform:uppercase;letter-spacing:0.5px;border:none;")
            val = QLabel("—")
            val.setStyleSheet("color:#e2dcd6;font-size:12px;border:none;")
            val.setWordWrap(True)
            val.setTextInteractionFlags(Qt.TextSelectableByMouse)
            outer.addWidget(lbl)
            outer.addWidget(val)
            cf_lay.addLayout(outer)
            return val

        self.card_email_val = _field("Email")
        self.card_name_val = _field("Имя")
        self.card_reg_val = _field("Зарегистрирован")

        sep2 = QFrame()
        sep2.setFrameShape(QFrame.HLine)
        sep2.setStyleSheet("border:none;border-top:1px solid #2a2724;margin:2px 0;")
        cf_lay.addWidget(sep2)

        persona_lbl = QLabel("ПЕРСОНАЛИЗАЦИЯ")
        persona_lbl.setStyleSheet(
            "color:#5c5650;font-size:10px;font-weight:600;"
            "letter-spacing:0.5px;border:none;"
        )
        cf_lay.addWidget(persona_lbl)

        self.card_persona_val = QLabel("—")
        self.card_persona_val.setStyleSheet(
            "color:#9e968e;font-size:12px;line-height:1.5;border:none;"
        )
        self.card_persona_val.setWordWrap(True)
        self.card_persona_val.setTextInteractionFlags(Qt.TextSelectableByMouse)
        cf_lay.addWidget(self.card_persona_val)

        cf_lay.addStretch()

        # Stats row at bottom
        sep3 = QFrame()
        sep3.setFrameShape(QFrame.HLine)
        sep3.setStyleSheet("border:none;border-top:1px solid #2a2724;margin:2px 0;")
        cf_lay.addWidget(sep3)

        stats_row = QHBoxLayout()
        stats_row.setSpacing(0)
        for attr, title in [("card_chats_val", "Чатов"), ("card_msgs_val", "Сообщений")]:
            col = QVBoxLayout()
            col.setSpacing(1)
            v = QLabel("—")
            v.setStyleSheet("font-size:18px;font-weight:700;color:#e2dcd6;border:none;")
            v.setAlignment(Qt.AlignCenter)
            t = QLabel(title)
            t.setStyleSheet("color:#5c5650;font-size:10px;border:none;")
            t.setAlignment(Qt.AlignCenter)
            col.addWidget(v)
            col.addWidget(t)
            setattr(self, attr, v)
            stats_row.addLayout(col)
        cf_lay.addLayout(stats_row)

        card_lay.addWidget(self.card_frame)
        card_lay.addStretch()

        splitter.addWidget(self.card_widget)
        splitter.setStretchFactor(0, 3)
        splitter.setStretchFactor(1, 1)

        lay.addWidget(splitter)

    # ── data ──

    def refresh(self):
        conn = get_db()
        users = conn.execute(
            "SELECT id, username FROM users ORDER BY username ASC"
        ).fetchall()
        self._users = [dict(u) for u in users]

        rows = conn.execute("""
            SELECT c.*, u.username,
                   COUNT(m.id) as msg_count
            FROM chats c
            JOIN users u ON u.id = c.user_id
            LEFT JOIN messages m ON m.chat_id = c.id
            GROUP BY c.id
            ORDER BY c.updated_at DESC
        """).fetchall()
        conn.close()
        self._chats = [dict(r) for r in rows]

        # Rebuild combo preserving selection
        prev_user_id = self._selected_user_id
        self.user_combo.blockSignals(True)
        self.user_combo.clear()
        self.user_combo.addItem("— Все пользователи —", None)
        for u in self._users:
            self.user_combo.addItem(u['username'], u['id'])
        # restore selection
        restored = False
        if prev_user_id is not None:
            for i in range(self.user_combo.count()):
                if self.user_combo.itemData(i) == prev_user_id:
                    self.user_combo.setCurrentIndex(i)
                    restored = True
                    break
        if not restored:
            self.user_combo.setCurrentIndex(0)
            self._selected_user_id = None
        self.user_combo.blockSignals(False)

        self._apply_filter()

    def _apply_filter(self):
        if self._selected_user_id is None:
            visible = self._chats
        else:
            visible = [c for c in self._chats if c.get('user_id') == self._selected_user_id]
        self._render(visible)
        self.stats_lbl.setText(f"Чатов: {len(visible)}")

    def _on_user_changed(self, index):
        self._selected_user_id = self.user_combo.itemData(index)
        self._apply_filter()
        if self._selected_user_id is None:
            self._hide_card()
        else:
            self._load_card(self._selected_user_id)

    def _hide_card(self):
        self.card_frame.hide()
        self.card_placeholder.show()

    def _load_card(self, user_id):
        conn = get_db()
        u = conn.execute("""
            SELECT u.*,
                   s.plan, s.expires_at,
                   COUNT(DISTINCT c.id) AS chat_count,
                   COUNT(DISTINCT m.id) AS msg_count
            FROM users u
            LEFT JOIN subscriptions s ON s.user_id = u.id
            LEFT JOIN chats c ON c.user_id = u.id
            LEFT JOIN messages m ON m.chat_id = c.id
            WHERE u.id=?
            GROUP BY u.id
        """, (user_id,)).fetchone()

        persona_text = "—"
        try:
            pref = conn.execute(
                "SELECT * FROM user_preferences WHERE user_id=?", (user_id,)
            ).fetchone()
            if pref:
                pref = dict(pref)
                parts = []
                for k, v in pref.items():
                    if k in ('id', 'user_id'):
                        continue
                    if v:
                        parts.append(f"{k}: {v}")
                if parts:
                    persona_text = "\n".join(parts)
        except Exception:
            pass

        if not persona_text or persona_text == "—":
            try:
                mem = conn.execute(
                    "SELECT * FROM user_memory WHERE user_id=? LIMIT 1", (user_id,)
                ).fetchone()
                if mem:
                    mem = dict(mem)
                    parts = [f"{k}: {v}" for k, v in mem.items()
                             if k not in ('id', 'user_id') and v]
                    if parts:
                        persona_text = "\n".join(parts)
            except Exception:
                pass

        conn.close()

        if not u:
            self._hide_card()
            return

        u = dict(u)
        self.card_placeholder.hide()
        self.card_frame.show()

        self.card_username.setText(u.get('username', '—'))
        self.card_email_val.setText(u.get('email', '—'))
        self.card_name_val.setText(u.get('name') or u.get('full_name') or '—')
        self.card_reg_val.setText(fmt_dt(u.get('created_at')))
        self.card_persona_val.setText(persona_text)
        self.card_chats_val.setText(str(u.get('chat_count', 0)))
        self.card_msgs_val.setText(str(u.get('msg_count', 0)))

        if u.get('plan'):
            exp = fmt_dt(u.get('expires_at'))
            self.card_sub_badge.setText(f"Pro  •  до {exp}")
            self.card_sub_badge.setStyleSheet(BADGE_SUB)
        else:
            self.card_sub_badge.setText("Free")
            self.card_sub_badge.setStyleSheet(BADGE_FREE)

    def _render(self, chats):
        self.table.setRowCount(0)
        for chat in chats:
            r = self.table.rowCount()
            self.table.insertRow(r)
            item = QTableWidgetItem(chat.get('title', 'Новый чат'))
            item.setData(Qt.UserRole, chat)
            self.table.setItem(r, 0, item)
            self.table.setItem(r, 1, QTableWidgetItem(chat.get('model', '—')))
            self.table.setItem(r, 2, QTableWidgetItem(str(chat.get('msg_count', 0))))
            self.table.setItem(r, 3, QTableWidgetItem(fmt_dt(chat.get('created_at'))))
            self.table.setItem(r, 4, QTableWidgetItem(fmt_dt(chat.get('updated_at'))))
        self.table.resizeRowsToContents()

    def _selected_chat(self):
        rows = self.table.selectedItems()
        if not rows:
            return None
        return self.table.item(rows[0].row(), 0).data(Qt.UserRole)

    def _ctx_menu(self, pos):
        c = self._selected_chat()
        if not c:
            return
        menu = QMenu(self)
        menu.addAction("👁  Открыть", self._open_chat)
        menu.addSeparator()
        menu.addAction("🗑️  Удалить чат", self._delete_chat)
        menu.exec_(self.table.viewport().mapToGlobal(pos))

    def _open_chat(self):
        c = self._selected_chat()
        if not c:
            return
        dlg = ChatMessagesDialog(c, self)
        dlg.exec_()

    def _delete_chat(self):
        c = self._selected_chat()
        if not c:
            return
        r = QMessageBox.question(
            self, "Удалить чат?",
            f"Удалить чат <b>{c.get('title','—')}</b> и все сообщения?",
            QMessageBox.Yes | QMessageBox.No
        )
        if r != QMessageBox.Yes:
            return
        try:
            conn = get_db()
            conn.execute("DELETE FROM chats WHERE id=?", (c['id'],))
            conn.commit()
            conn.close()
            self.refresh()
            self.status_msg.emit(f"Чат «{c.get('title','—')}» удалён")
        except Exception as e:
            QMessageBox.critical(self, "Ошибка", str(e))


# ═══════════════════════════════════════════════════════════════════════════════
#  REACTIONS TAB
# ═══════════════════════════════════════════════════════════════════════════════

class ReactionContextWidget(QWidget):
    """Показывает 5 сообщений вокруг оцененного сообщения."""

    def __init__(self, parent=None):
        super().__init__(parent)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)

        self.title_lbl = QLabel("Контекст сообщения")
        self.title_lbl.setStyleSheet(
            "font-size:12px;font-weight:600;color:#9e968e;"
            "padding:8px 12px 6px;border-bottom:1px solid #2a2724;"
        )
        lay.addWidget(self.title_lbl)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        self.inner = QWidget()
        self.inner_lay = QVBoxLayout(self.inner)
        self.inner_lay.setContentsMargins(8, 8, 8, 8)
        self.inner_lay.setSpacing(8)
        self.inner_lay.addStretch()
        scroll.setWidget(self.inner)
        lay.addWidget(scroll)
        self._scroll = scroll

    def load(self, message_id: str, reaction_type: str):
        # Clear
        while self.inner_lay.count() > 1:
            item = self.inner_lay.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        conn = get_db()
        # get the target message
        target = conn.execute(
            "SELECT * FROM messages WHERE id=?", (message_id,)
        ).fetchone()
        if not target:
            conn.close()
            return

        target = dict(target)
        chat_id = target['chat_id']

        # get all messages in chat ordered by time
        all_msgs = conn.execute(
            "SELECT * FROM messages WHERE chat_id=? ORDER BY created_at ASC",
            (chat_id,)
        ).fetchall()
        all_msgs = [dict(m) for m in all_msgs]
        conn.close()

        # find index of target
        idx = next((i for i, m in enumerate(all_msgs) if m['id'] == message_id), None)
        if idx is None:
            return

        # take 5 messages: 2 before, target, 2 after
        start = max(0, idx - 2)
        end = min(len(all_msgs), idx + 3)
        window = all_msgs[start:end]

        emoji = "👍" if reaction_type == "like" else "👎"
        self.title_lbl.setText(
            f"{emoji}  Контекст  —  сообщение #{idx + 1} из {len(all_msgs)}"
        )

        for msg in window:
            is_target = msg['id'] == message_id
            is_user = msg['role'] == 'user'

            outer = QHBoxLayout()
            outer.setContentsMargins(0, 0, 0, 0)

            bubble = QFrame()
            bubble.setMaximumWidth(440)
            b_lay = QVBoxLayout(bubble)
            b_lay.setContentsMargins(10, 7, 10, 7)
            b_lay.setSpacing(3)

            role_row = QHBoxLayout()
            role_lbl = QLabel("Вы" if is_user else "Averon AI")
            role_lbl.setStyleSheet(
                f"font-size:11px;font-weight:600;"
                f"color:{'#c97a5a' if is_user else '#9e968e'};"
            )
            role_row.addWidget(role_lbl)

            if is_target:
                react_badge = QLabel(emoji)
                react_badge.setStyleSheet(
                    f"font-size:14px;margin-left:6px;"
                )
                role_row.addWidget(react_badge)
            role_row.addStretch()

            time_lbl = QLabel(fmt_dt(msg.get('created_at')))
            time_lbl.setStyleSheet("font-size:10px;color:#5c5650;")
            role_row.addWidget(time_lbl)
            b_lay.addLayout(role_row)

            content = msg.get('content', '')
            if len(content) > 800:
                content = content[:800] + "\n…"
            text_lbl = QLabel(content)
            text_lbl.setWordWrap(True)
            text_lbl.setTextInteractionFlags(Qt.TextSelectableByMouse)
            text_lbl.setStyleSheet("font-size:12px;line-height:1.5;")
            b_lay.addWidget(text_lbl)

            if is_target:
                highlight = "#3a2f1e" if reaction_type == "like" else "#3a1e1e"
                border = "#c97a5a44" if reaction_type == "like" else "#f8717144"
                bubble.setStyleSheet(
                    f"background:{highlight};border:1px solid {border};"
                    f"border-radius:{'12px 4px 12px 12px' if is_user else '4px 12px 12px 12px'};"
                )
            elif is_user:
                bubble.setStyleSheet(
                    "background:#2a2420;border:1px solid #3a2f28;"
                    "border-radius:12px 4px 12px 12px;"
                )
            else:
                bubble.setStyleSheet(
                    "background:#252220;border:1px solid #2a2724;"
                    "border-radius:4px 12px 12px 12px;"
                )

            if is_user:
                outer.addStretch()
                outer.addWidget(bubble)
            else:
                outer.addWidget(bubble)
                outer.addStretch()

            wrapper = QWidget()
            wrapper.setLayout(outer)
            self.inner_lay.insertWidget(self.inner_lay.count() - 1, wrapper)

        QTimer.singleShot(50, lambda: self._scroll.verticalScrollBar().setValue(
            self._scroll.verticalScrollBar().maximum()))


class SingleReactionTab(QWidget):
    """Один из подтабов: Лайки или Дизлайки."""

    def __init__(self, reaction_type: str, parent=None):
        super().__init__(parent)
        self.reaction_type = reaction_type
        self._build()
        self.refresh()

    def _build(self):
        lay = QHBoxLayout(self)
        lay.setContentsMargins(0, 8, 0, 0)
        lay.setSpacing(0)

        splitter = QSplitter(Qt.Horizontal)

        # Left: reaction list
        left = QWidget()
        l_lay = QVBoxLayout(left)
        l_lay.setContentsMargins(0, 0, 4, 0)
        l_lay.setSpacing(6)

        tb = QHBoxLayout()
        self.search_edit = QLineEdit()
        self.search_edit.setPlaceholderText("🔍  Поиск по пользователю / сообщению…")
        self.search_edit.textChanged.connect(self._filter)
        refresh_btn = QPushButton("⟳")
        refresh_btn.setFixedWidth(34)
        refresh_btn.clicked.connect(self.refresh)
        tb.addWidget(self.search_edit)
        tb.addWidget(refresh_btn)
        l_lay.addLayout(tb)

        self.table = QTableWidget()
        self.table.setColumnCount(4)
        self.table.setHorizontalHeaderLabels([
            "Пользователь", "Начало сообщения", "Чат", "Дата"
        ])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Interactive)
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().setVisible(False)
        self.table.selectionModel().selectionChanged.connect(self._on_select)
        self.table.setColumnWidth(0, 110)
        self.table.setColumnWidth(1, 220)
        self.table.setColumnWidth(2, 140)
        l_lay.addWidget(self.table)

        self.count_lbl = QLabel()
        self.count_lbl.setStyleSheet("color:#9e968e;font-size:11px;")
        l_lay.addWidget(self.count_lbl)

        splitter.addWidget(left)

        # Right: context
        self.context_widget = ReactionContextWidget()
        self.context_widget.setMinimumWidth(280)
        splitter.addWidget(self.context_widget)

        splitter.setStretchFactor(0, 2)
        splitter.setStretchFactor(1, 3)
        lay.addWidget(splitter)

        self._data = []

    def refresh(self):
        conn = get_db()
        rows = conn.execute("""
            SELECT mr.id, mr.message_id, mr.user_id, mr.created_at,
                   u.username,
                   m.content AS msg_content,
                   c.title AS chat_title,
                   c.id AS chat_id
            FROM message_reactions mr
            JOIN users u ON u.id = mr.user_id
            JOIN messages m ON m.id = mr.message_id
            JOIN chats c ON c.id = m.chat_id
            WHERE mr.reaction = ?
            ORDER BY mr.created_at DESC
        """, (self.reaction_type,)).fetchall()
        conn.close()
        self._data = [dict(r) for r in rows]
        self._render(self._data)

    def _render(self, data):
        self.table.setRowCount(0)
        emoji = "👍" if self.reaction_type == "like" else "👎"
        for row in data:
            r = self.table.rowCount()
            self.table.insertRow(r)

            user_item = QTableWidgetItem(row.get('username', '—'))
            user_item.setData(Qt.UserRole, row)
            self.table.setItem(r, 0, user_item)

            content = (row.get('msg_content') or '').replace('\n', ' ')[:80]
            self.table.setItem(r, 1, QTableWidgetItem(content))
            self.table.setItem(r, 2, QTableWidgetItem(row.get('chat_title', '—')))
            self.table.setItem(r, 3, QTableWidgetItem(fmt_dt(row.get('created_at'))))

        self.table.resizeRowsToContents()
        self.count_lbl.setText(f"{emoji}  Всего: {len(data)}")

    def _filter(self, text):
        text = text.lower()
        filtered = [r for r in self._data
                    if text in r.get('username', '').lower()
                    or text in (r.get('msg_content') or '').lower()]
        self._render(filtered)

    def _on_select(self):
        rows = self.table.selectedItems()
        if not rows:
            return
        row = self.table.item(rows[0].row(), 0).data(Qt.UserRole)
        if row:
            self.context_widget.load(row['message_id'], self.reaction_type)


class ReactionsTab(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(12, 8, 12, 12)

        sub_tabs = QTabWidget()
        sub_tabs.setTabPosition(QTabWidget.North)

        self.likes_tab = SingleReactionTab("like")
        self.dislikes_tab = SingleReactionTab("dislike")

        sub_tabs.addTab(self.likes_tab, "👍  Лайки")
        sub_tabs.addTab(self.dislikes_tab, "👎  Дизлайки")

        lay.addWidget(sub_tabs)

    def refresh(self):
        self.likes_tab.refresh()
        self.dislikes_tab.refresh()


# ═══════════════════════════════════════════════════════════════════════════════
#  STATS TAB
# ═══════════════════════════════════════════════════════════════════════════════

class StatsTab(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self._build()
        self.refresh()

    def _build(self):
        lay = QVBoxLayout(self)
        lay.setContentsMargins(12, 12, 12, 12)
        lay.setSpacing(12)

        refresh_btn = QPushButton("⟳  Обновить")
        refresh_btn.setFixedWidth(120)
        refresh_btn.clicked.connect(self.refresh)
        lay.addWidget(refresh_btn, alignment=Qt.AlignLeft)

        # metric cards row
        cards_row = QHBoxLayout()
        cards_row.setSpacing(10)
        self._cards = {}
        for key, label in [
            ("users", "Пользователей"),
            ("subs", "Подписок Pro"),
            ("chats", "Чатов"),
            ("messages", "Сообщений"),
            ("reactions", "Реакций"),
        ]:
            card = QFrame()
            card.setStyleSheet(
                "background:#252220;border:1px solid #2a2724;"
                "border-radius:10px;padding:4px;"
            )
            c_lay = QVBoxLayout(card)
            c_lay.setSpacing(2)
            val_lbl = QLabel("—")
            val_lbl.setStyleSheet("font-size:28px;font-weight:700;color:#e2dcd6;")
            lbl = QLabel(label)
            lbl.setStyleSheet("font-size:11px;color:#9e968e;")
            c_lay.addWidget(val_lbl)
            c_lay.addWidget(lbl)
            self._cards[key] = val_lbl
            cards_row.addWidget(card)
        lay.addLayout(cards_row)

        # Top users
        grp = QGroupBox("Топ пользователей по сообщениям")
        g_lay = QVBoxLayout(grp)
        self.top_users_table = QTableWidget()
        self.top_users_table.setColumnCount(4)
        self.top_users_table.setHorizontalHeaderLabels(
            ["Пользователь", "Чатов", "Сообщений", "Подписка"]
        )
        self.top_users_table.horizontalHeader().setStretchLastSection(True)
        self.top_users_table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.top_users_table.setAlternatingRowColors(True)
        self.top_users_table.verticalHeader().setVisible(False)
        self.top_users_table.setMaximumHeight(220)
        g_lay.addWidget(self.top_users_table)
        lay.addWidget(grp)

        # Model usage
        grp2 = QGroupBox("Использование моделей")
        g2_lay = QVBoxLayout(grp2)
        self.model_table = QTableWidget()
        self.model_table.setColumnCount(3)
        self.model_table.setHorizontalHeaderLabels(["Модель", "Чатов", "% от всех"])
        self.model_table.horizontalHeader().setStretchLastSection(True)
        self.model_table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.model_table.setAlternatingRowColors(True)
        self.model_table.verticalHeader().setVisible(False)
        self.model_table.setMaximumHeight(180)
        g2_lay.addWidget(self.model_table)
        lay.addWidget(grp2)

        lay.addStretch()

    def refresh(self):
        conn = get_db()
        users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        subs = conn.execute("SELECT COUNT(*) FROM subscriptions WHERE expires_at > datetime('now')").fetchone()[0]
        chats = conn.execute("SELECT COUNT(*) FROM chats").fetchone()[0]
        messages = conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
        reactions = conn.execute("SELECT COUNT(*) FROM message_reactions").fetchone()[0]

        self._cards["users"].setText(str(users))
        self._cards["subs"].setText(str(subs))
        self._cards["chats"].setText(str(chats))
        self._cards["messages"].setText(str(messages))
        self._cards["reactions"].setText(str(reactions))

        # top users
        top = conn.execute("""
            SELECT u.username, COUNT(DISTINCT c.id) as chat_cnt,
                   COUNT(m.id) as msg_cnt,
                   CASE WHEN s.id IS NOT NULL THEN 'Pro' ELSE 'Free' END as plan
            FROM users u
            LEFT JOIN chats c ON c.user_id = u.id
            LEFT JOIN messages m ON m.chat_id = c.id
            LEFT JOIN subscriptions s ON s.user_id = u.id AND s.expires_at > datetime('now')
            GROUP BY u.id
            ORDER BY msg_cnt DESC
            LIMIT 15
        """).fetchall()
        self.top_users_table.setRowCount(0)
        for row in top:
            r = self.top_users_table.rowCount()
            self.top_users_table.insertRow(r)
            self.top_users_table.setItem(r, 0, QTableWidgetItem(row[0]))
            self.top_users_table.setItem(r, 1, QTableWidgetItem(str(row[1])))
            self.top_users_table.setItem(r, 2, QTableWidgetItem(str(row[2])))
            plan_item = QTableWidgetItem(row[3])
            if row[3] == "Pro":
                plan_item.setForeground(QBrush(QColor("#4ade80")))
            else:
                plan_item.setForeground(QBrush(QColor("#9e968e")))
            self.top_users_table.setItem(r, 3, plan_item)
        self.top_users_table.resizeRowsToContents()

        # model usage
        models = conn.execute("""
            SELECT model, COUNT(*) as cnt
            FROM chats
            GROUP BY model
            ORDER BY cnt DESC
        """).fetchall()
        total_chats = max(chats, 1)
        self.model_table.setRowCount(0)
        for row in models:
            r = self.model_table.rowCount()
            self.model_table.insertRow(r)
            self.model_table.setItem(r, 0, QTableWidgetItem(row[0] or "flash"))
            self.model_table.setItem(r, 1, QTableWidgetItem(str(row[1])))
            pct = f"{row[1] / total_chats * 100:.1f}%"
            self.model_table.setItem(r, 2, QTableWidgetItem(pct))
        self.model_table.resizeRowsToContents()

        conn.close()


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN WINDOW
# ═══════════════════════════════════════════════════════════════════════════════

class AdminWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Averon AI — Admin Panel")
        self.resize(1200, 760)
        self._build()
        self._check_db()

    def _check_db(self):
        if not os.path.exists(DB_PATH):
            QMessageBox.warning(
                self, "База данных не найдена",
                f"Файл не найден:\n{DB_PATH}\n\n"
                "Запустите сервер хотя бы раз для инициализации БД,\n"
                "или укажите путь: python admin_panel.py --db /path/to/averon.db"
            )
            self.status.showMessage(f"❌  БД не найдена: {DB_PATH}")
        else:
            self.status.showMessage(f"✓  {DB_PATH}")

    def _build(self):
        self.setStyleSheet(DARK_QSS)

        # toolbar
        tb = QToolBar()
        tb.setMovable(False)
        tb.setIconSize(QSize(16, 16))

        logo_lbl = QLabel("  ◈  Averon Admin  ")
        logo_lbl.setStyleSheet("color:#c97a5a;font-weight:700;font-size:14px;")
        tb.addWidget(logo_lbl)

        spacer = QWidget()
        spacer.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)
        tb.addWidget(spacer)

        db_lbl = QLabel(f"  БД: {os.path.basename(DB_PATH)}  ")
        db_lbl.setStyleSheet("color:#5c5650;font-size:11px;")
        tb.addWidget(db_lbl)

        refresh_all_btn = QPushButton("⟳  Обновить всё")
        refresh_all_btn.setFixedHeight(28)
        refresh_all_btn.clicked.connect(self._refresh_all)
        tb.addWidget(refresh_all_btn)
        self.addToolBar(tb)

        # tabs
        self.tabs = QTabWidget()
        self.tabs.setTabPosition(QTabWidget.North)

        self.users_tab = UsersTab()
        self.users_tab.status_msg.connect(self._show_status)
        self.tabs.addTab(self.users_tab, "👤  Пользователи")

        self.chats_tab = ChatsTab()
        self.chats_tab.status_msg.connect(self._show_status)
        self.tabs.addTab(self.chats_tab, "💬  Чаты")

        self.reactions_tab = ReactionsTab()
        self.tabs.addTab(self.reactions_tab, "⚡  Реакции")

        self.stats_tab = StatsTab()
        self.tabs.addTab(self.stats_tab, "📊  Статистика")

        self.setCentralWidget(self.tabs)

        # status bar
        self.status = QStatusBar()
        self.setStatusBar(self.status)

    def _show_status(self, msg: str):
        self.status.showMessage(msg, 5000)

    def _refresh_all(self):
        self.users_tab.refresh()
        self.chats_tab.refresh()
        self.reactions_tab.refresh()
        self.stats_tab.refresh()
        self.status.showMessage("Данные обновлены", 3000)


# ─────────────────────────────────────────────────────────────────────────────

def main():
    app = QApplication(sys.argv)
    app.setApplicationName("Averon Admin")

    # set global font
    font = QFont("Segoe UI", 10)
    app.setFont(font)

    win = AdminWindow()
    win.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
