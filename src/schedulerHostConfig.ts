
export let getCurrentTime: () => number
export let requestHostTimeout: (callback: (currentTime: number) => void, ms: number) => void
export let cancelHostTimeout: () => void
export let requestHostCallback: (cb: ScheduledHostCallback) => void
export let cancelHostCallback: () => void
export let shouldYieldToHost: () => boolean
export let requestPaint: () => void
export let forceFrameRate: (fps: number) => void

interface ScheduledHostCallback {
    (hasTimeRemaining: boolean, currentTime: number): boolean
}

// not a browser environment or not support MessageChannel
if (typeof window === 'undefined' || typeof MessageChannel !== 'function') {
    let _callback: ScheduledHostCallback | null = null
    let _timeoutID = -1

    const _flushCallback = () => {
        if (_callback !== null) {
            try {
                const currentTime = getCurrentTime()
                const hasTimeRemaining = true;
                _callback(hasTimeRemaining, currentTime)
                _callback = null
            } catch(e) {
                setTimeout(_flushCallback, 0)
                throw e
            }
        }
    }

    getCurrentTime = () => Date.now()
    requestHostCallback = (cb) => {
        if (_callback !== null) {
            // Protect against re-entrancy.
            setTimeout(requestHostCallback, 0, cb)
        } else {
            _callback = cb
            setTimeout(_flushCallback, 0)
        }
    }
    cancelHostCallback = () => {
        _callback = null
    }
    requestHostTimeout = (cb: (currentTime: number) => void, ms: number) => {
        _timeoutID = setTimeout(cb, ms)
    }
    cancelHostTimeout = () => {
        clearTimeout(_timeoutID)
    }
    shouldYieldToHost = () => false
    requestPaint = () => {}
    forceFrameRate = () => {}
} else {
    const setTimeout = window.setTimeout

    let isRAFLoopRunning = false
    let scheduledHostCallback: ScheduledHostCallback | null = null
    let rAFTimeoutID = -1
    let taskTimeoutID = -1

    let frameLength = 16
    let frameDeadline = 0

    getCurrentTime = () => performance && typeof performance.now === 'function' ? performance.now() : Date.now()

    const performWorkUntilDeadline = () => {
        if (scheduledHostCallback !== null) {
            const currentTime = getCurrentTime()
            const hasTimeRemaining = frameDeadline - currentTime > 0
            const hasMoreWork = scheduledHostCallback(hasTimeRemaining, currentTime)
            if (!hasMoreWork) {
                scheduledHostCallback = null
            }
        }
    }

    const channel = new MessageChannel()
    const port = channel.port2
    channel.port1.onmessage = performWorkUntilDeadline

    const onAnimationFrame = (rafTime: number) => {
        if (scheduledHostCallback === null) {
            isRAFLoopRunning = false
            return
        }

        isRAFLoopRunning = true
        requestAnimationFrame(nextRAFTime => {
            clearTimeout(rAFTimeoutID)
            onAnimationFrame(nextRAFTime)
        })

        const onTimeout = () => {
            frameDeadline = getCurrentTime() + frameLength / 2
            performWorkUntilDeadline()
            rAFTimeoutID = setTimeout(onTimeout, frameLength * 3)
        }
        rAFTimeoutID = setTimeout(onTimeout, frameLength * 3)

        // We use the postMessage trick to defer idle work until after the repaint.
        port.postMessage(null)
    }


    requestHostCallback = (callback: ScheduledHostCallback) => {
        scheduledHostCallback = callback
        if (!isRAFLoopRunning) {
            isRAFLoopRunning = true
            requestAnimationFrame(rafTime => {
                onAnimationFrame(rafTime)
            })
        }
    }

    cancelHostCallback = () => { scheduledHostCallback = null }

    requestHostTimeout = (callback: (currentTime: number) => void, ms: number) => {
        taskTimeoutID = setTimeout(() => {
            callback(getCurrentTime())
        }, ms)
    }

    cancelHostTimeout = () => {
        clearTimeout(taskTimeoutID)
        taskTimeoutID = -1
    }
    shouldYieldToHost = () => getCurrentTime() > frameDeadline
    requestPaint = () => {}
    forceFrameRate = (fps: number) => {
        if (fps < 0 || fps > 125) {
            console.error('forceFrameRate takes a positive int between 0 and 125, forcing framerates higher than 125 fps is not supported')
            return
        }

        frameLength = Math.floor(1000 / fps)
    }
}
