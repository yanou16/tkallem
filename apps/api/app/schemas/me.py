from pydantic import BaseModel, ConfigDict, model_validator
from tkallem_agent.schemas import ExplainLang, Level


class Me(BaseModel):
    first_name: str | None
    level: Level | None
    explain_lang: ExplainLang


class MeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    level: Level | None = None
    explain_lang: ExplainLang | None = None

    @model_validator(mode="after")
    def check_fields(self):
        if not self.model_fields_set:
            raise ValueError("send at least one field")
        for name in self.model_fields_set:
            if getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self

    def changes(self) -> dict:
        return self.model_dump(exclude_unset=True)