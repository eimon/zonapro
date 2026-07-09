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


class QuoteStatus(str, Enum):
    borrador = "borrador"
    enviada = "enviada"
    aprobada = "aprobada"
    rechazada = "rechazada"
    vencida = "vencida"


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
