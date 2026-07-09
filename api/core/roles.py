from enum import Enum


class Permission(str, Enum):
    # Usuarios
    USER_MANAGE = "USER_MANAGE"

    # Catálogo
    PRODUCT_MANAGE = "PRODUCT_MANAGE"

    # Carrito y órdenes
    CART_MANAGE = "CART_MANAGE"
    ORDER_CREATE = "ORDER_CREATE"
    ORDER_VIEW_OWN = "ORDER_VIEW_OWN"
    ORDER_VIEW_ALL = "ORDER_VIEW_ALL"

    # Presupuestos
    QUOTE_CREATE = "QUOTE_CREATE"
    QUOTE_VIEW_OWN = "QUOTE_VIEW_OWN"
    QUOTE_VIEW_ALL = "QUOTE_VIEW_ALL"

    # Paquetes
    PACKAGE_MANAGE = "PACKAGE_MANAGE"

    # Consultas
    CONSULTATION_MANAGE = "CONSULTATION_MANAGE"

    # Configuración
    SETTINGS_MANAGE = "SETTINGS_MANAGE"


role_hierarchy: dict[str, list[Permission]] = {
    "ADMIN": [
        Permission.USER_MANAGE,
        Permission.PRODUCT_MANAGE,
        Permission.CART_MANAGE,
        Permission.ORDER_CREATE,
        Permission.ORDER_VIEW_OWN,
        Permission.ORDER_VIEW_ALL,
        Permission.QUOTE_CREATE,
        Permission.QUOTE_VIEW_OWN,
        Permission.QUOTE_VIEW_ALL,
        Permission.PACKAGE_MANAGE,
        Permission.CONSULTATION_MANAGE,
        Permission.SETTINGS_MANAGE,
    ],
    "VENDEDOR": [
        Permission.PRODUCT_MANAGE,
        Permission.QUOTE_CREATE,
        Permission.QUOTE_VIEW_OWN,
        Permission.ORDER_VIEW_ALL,
        Permission.CONSULTATION_MANAGE,
    ],
    "CLIENTE": [
        Permission.CART_MANAGE,
        Permission.ORDER_CREATE,
        Permission.ORDER_VIEW_OWN,
    ],
}
