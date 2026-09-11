from enum import Enum


class PackageComplexity(str, Enum):
    basico = "basico"
    medio = "medio"
    avanzado = "avanzado"


class ConsultationType(str, Enum):
    product = "product"
    package = "package"
    free_form = "free_form"


class ConsultationStatus(str, Enum):
    pendiente = "pendiente"
    en_proceso = "en_proceso"
    cerrada = "cerrada"


class QuoteItemKind(str, Enum):
    product = "product"
    service = "service"


class QuoteType(str, Enum):
    productos = "productos"
    servicios = "servicios"


class QuoteStatus(str, Enum):
    borrador = "borrador"
    enviada = "enviada"
    aprobada = "aprobada"
    rechazada = "rechazada"
    vencida = "vencida"


class InstallationCostType(str, Enum):
    fixed = "fixed"
    percentage = "percentage"


class IvaRate(str, Enum):
    iva_0 = "0"
    iva_10_5 = "10.5"
    iva_21 = "21"


class OrderStatus(str, Enum):
    pendiente = "pendiente"
    pagada = "pagada"
    en_preparacion = "en_preparacion"
    enviada = "enviada"
    completada = "completada"
    cancelada = "cancelada"


class CheckoutStatus(str, Enum):
    pending = "pending"
    confirmed = "confirmed"
    failed = "failed"
    cancelled = "cancelled"
