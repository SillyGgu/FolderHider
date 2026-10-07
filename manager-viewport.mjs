// A manager belongs to the visible viewport, independently of ST's chat/drawers.
// visualViewport also reports keyboard resizing/panning on mobile Safari/Chrome.
export function bindManagerViewport(overlay) {
    const modal = overlay.querySelector('.toc-manager-modal');
    const viewport = window.visualViewport;
    let frame = null;
    let disposed = false;
    overlay.classList.add('fh-viewport-manager');

    function update() {
        frame = null;
        if (disposed || !overlay.isConnected) return;
        const width = viewport?.width || window.innerWidth;
        const height = viewport?.height || window.innerHeight;
        overlay.style.setProperty('--fh-viewport-left', `${viewport?.offsetLeft || 0}px`);
        overlay.style.setProperty('--fh-viewport-top', `${viewport?.offsetTop || 0}px`);
        overlay.style.setProperty('--fh-viewport-width', `${width}px`);
        overlay.style.setProperty('--fh-viewport-height', `${height}px`);

        // Keep a usable list even when toolbars wrap, fonts grow, or the keyboard
        // leaves too little space. In that case the middle section scrolls as one.
        const fixedHeight = [...modal.querySelectorAll('.toc-header, .toc-footer, .toc-toolbar, #pm_drop_targets')]
            .reduce((sum, element) => sum + element.getBoundingClientRect().height, 0);
        overlay.classList.toggle('fh-manager-compact', height <= 520 || fixedHeight + 120 > modal.clientHeight);
    }

    function scheduleUpdate() {
        if (!disposed && frame === null) frame = requestAnimationFrame(update);
    }

    update();
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('orientationchange', scheduleUpdate);
    viewport?.addEventListener('resize', scheduleUpdate);
    viewport?.addEventListener('scroll', scheduleUpdate);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleUpdate) : null;
    for (const element of [modal, ...modal.querySelectorAll('.toc-header, .toc-footer, .toc-toolbar, #pm_drop_targets')]) {
        observer?.observe(element);
    }

    return () => {
        disposed = true;
        if (frame !== null) cancelAnimationFrame(frame);
        observer?.disconnect();
        window.removeEventListener('resize', scheduleUpdate);
        window.removeEventListener('orientationchange', scheduleUpdate);
        viewport?.removeEventListener('resize', scheduleUpdate);
        viewport?.removeEventListener('scroll', scheduleUpdate);
    };
}

export function getManagerScrollElement(list) {
    return list.closest('.fh-manager-compact') ? list.closest('.fh-manager-content') : list;
}
