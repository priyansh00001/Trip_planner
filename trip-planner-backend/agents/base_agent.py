from abc import ABC, abstractmethod
from core.models import AgentResult
import httpx, logging

logger = logging.getLogger(__name__)

class BaseAgent(ABC):
    name: str = "base"

    async def run(self, state: dict) -> AgentResult:
        try:
            data = await self.fetch(state)
            return AgentResult(agent=self.name, status="ok", data=data)
        except Exception as e:
            logger.error(f"{self.name} failed: {e}")
            return AgentResult(agent=self.name, status="error", data={"error": str(e)})

    @abstractmethod
    async def fetch(self, state: dict) -> dict:
        ...

    async def get(self, url: str, params: dict = None, headers: dict = None) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url, params=params, headers=headers)
            r.raise_for_status()
            return r.json()
