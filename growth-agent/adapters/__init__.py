from . import base
from .koreapas import KoreapasAdapter

base.register(KoreapasAdapter())

__all__ = ["base"]
