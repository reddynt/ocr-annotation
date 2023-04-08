from pydantic import BaseModel
from pydantic import Json


class Entity(BaseModel):
    name: str
    colour: str
