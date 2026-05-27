import pytest
from scrapers.scheduler import start_scheduler, pipeline

@pytest.mark.asyncio
async def test_pipeline_initializes():
    """Verify ScraperPipeline singleton starts and reports correct status."""
    # start_scheduler() returns the pipeline singleton (backward compat shim)
    p = start_scheduler()
    assert p is pipeline

    # Start the pipeline (creates background tasks)
    await pipeline.start()
    try:
        assert pipeline.running is True

        status = pipeline.get_status()
        assert status["running"] is True
        assert len(status["tasks"]) == 3  # dest, transport, watchdog

        # All three tasks should be alive right after start
        for task_info in status["tasks"]:
            assert task_info["alive"] is True

        print(f"Pipeline tasks: {[t['name'] for t in status['tasks']]}")
    finally:
        await pipeline.stop()
        assert pipeline.running is False