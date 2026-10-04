async def _run(settings: config.Settings) -> None:
    from . import telegram_source, tradingview_source

    ex = build(settings)
    ex.startup()
    loop = asyncio.get_running_loop()
    stop = asyncio.Event()

    async def on_message(msg: dict) -> None:
        await loop.run_in_executor(None, ex.handle_message, msg)

    def _sig(*_):
        log.info("signal received — shutting down")
        loop.call_soon_threadsafe(stop.set)

    for s in (_signal.SIGINT, _signal.SIGTERM):
        try:
            loop.add_signal_handler(s, _sig)
        except (NotImplementedError, RuntimeError):  # pragma: no cover
            _signal.signal(s, _sig)

    signal_sources = tuple(
        s.strip().lower()
        for s in (os.environ.get("SIGNAL_SOURCES") or "telegram").split(",")
        if s.strip()
    )

    tasks = []

    if "telegram" in signal_sources:
        tasks.append(telegram_source.listen(settings, on_message, stop))

    if settings.tv_enabled and "tradingview" in signal_sources:
        tasks.append(
            tradingview_source.start_webhook_server(
                settings.tv_webhook_host,
                settings.tv_webhook_port,
                on_message,
                stop,
            )
        )

    try:
        if not tasks:
            raise SystemExit("No signal sources enabled")
        await asyncio.gather(*tasks)
    finally:
        ex.shutdown()
