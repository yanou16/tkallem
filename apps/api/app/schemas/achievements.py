from pydantic import BaseModel


class Achievement(BaseModel):
    id: str
    title: str
    description: str
    icon: str  # an icon name the front knows (apps/web/src/lib/icons.tsx)
    unlocked: bool
