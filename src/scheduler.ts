import { getCurrentTime, cancelHostTimeout, requestHostTimeout, requestHostCallback, shouldYieldToHost, requestPaint, forceFrameRate } from "./schedulerHostConfig"

interface TaskCallback {
    (didUserCallbackTimeout: boolean): TaskCallback
}

interface Task {
    callback: TaskCallback;
    priority: SchedulePriority;
    startTime: number;
    expirationTime: number;
    next: Task | null
    previous: Task | null
}

export enum SchedulePriority {
    IMMEDIATE_PRIORITY,
    USER_BLOCKING_PRIORITY,
    NORMAL_PRIORITY,
    LOW_PRIORITY,
    IDLE_PRIORITY
}

// Math.pow(2, 30) - 1
const MAX_SIGNED_31_BIT_INT = 1073741823

export const PriorityTimeout = {
    [SchedulePriority.IMMEDIATE_PRIORITY]: -1,
    [SchedulePriority.USER_BLOCKING_PRIORITY]: 250,
    [SchedulePriority.NORMAL_PRIORITY]: 5000,
    [SchedulePriority.LOW_PRIORITY]: 10000,
    [SchedulePriority.IDLE_PRIORITY]: MAX_SIGNED_31_BIT_INT
}

let firstDelayTask: Task | null = null
let firstTask: Task | null = null

let isSchedulerPaused = false
let isPerformingWork = false

let currentTask: Task | null = null
let currentPriority = SchedulePriority.NORMAL_PRIORITY

let isHostTimeoutScheduled = false
let isHostCallbackScheduled = false

// 按照一定顺序在双向循环链表中插入任务
function insertTask(firstTask: Task | null, newTask: Task, sortTimeName: 'startTime' | 'expirationTime') {
    const sortTime = newTask[sortTimeName]

    if (firstTask === null) {
        firstTask = newTask.next =  newTask.previous = newTask
    } else {
        let next = null
        let task = firstTask
        do {
            if (sortTime < task[sortTimeName]) {
                next = newTask
                break;
            }
            next = task.next
        } while (task !== firstTask)

        if (next === null) {
            next = firstTask
        } else if (next === firstTask) {
            firstTask = newTask
        }

        const previous = next.previous
        previous!.next = next!.previous = newTask
        newTask.previous = previous
        newTask.next = next
    }

}

function insertDelayTask(newTask: Task) {
    insertTask(firstDelayTask, newTask, 'startTime')
}

function insertScheduledTask(newTask: Task) {
    insertTask(firstTask, newTask, 'expirationTime')
}

// 从任务队列中取出相应的任务，进行回调，将回调产生的新任务加入到任务队列（继承之前任务的优先级和过期时间，并插入在相同过期任务之前）
function flushTask(task: Task, currentTime: number) {
    const next = task.next!
    if (next === task) {
        firstTask = null
    } else {
        if (task === firstTask) {
            firstTask = next
        }
        const previous = task.previous!
        previous.next = next
        next.previous = previous
    }
    task.next = task.previous = null

    let callback = task.callback
    let previousPriority = currentPriority
    let previousTask = currentTask
    currentPriority = task.priority
    currentTask = task
    let continuationCallback
    try {
        let didUserCallbackTimeout = task.expirationTime <= currentTime
        continuationCallback = callback(didUserCallbackTimeout)
    } catch (error) {
        throw error
    } finally {
        currentPriority = previousPriority
        currentTask = previousTask
    }

    if (typeof continuationCallback === 'function') {
        let continuationTask = task
        continuationTask.callback = continuationCallback
        insertScheduledTask(continuationTask)
    }
}

function flushWork(hasTimeRemaining: boolean, initialTime: number) {
    if (isSchedulerPaused) {
        return false;
    }

    isHostCallbackScheduled = false
    if (isHostTimeoutScheduled) {
        isHostTimeoutScheduled = false
        cancelHostTimeout()
    }

    let currentTime = initialTime
    advanceTimers(currentTime)

    isPerformingWork = true
    try {
        if (!hasTimeRemaining) {
            while (firstTask !== null && firstTask.expirationTime <= currentTime && !isSchedulerPaused) {
                flushTask(firstTask, currentTime)
                currentTime = getCurrentTime()
                advanceTimers(currentTime)
            }
        } else {
            if (firstTask !== null) {
                do {
                    flushTask(firstTask, currentTime)
                    currentTime = getCurrentTime()
                    advanceTimers(currentTime)
                } while (firstTask !== null && !shouldYieldToHost() && !isSchedulerPaused)
            }
        }

        if (firstTask !== null) {
            return true
        } else {
            if (firstDelayTask !== null) {
                requestHostTimeout(handleTimeout, firstDelayTask.startTime - currentTime)
            }
            return false
        }
    } finally {
        isPerformingWork = false
        return false
    }
}

function handleTimeout(currentTime: number) {
    isHostTimeoutScheduled = false
    advanceTimers(currentTime)

    if (!isHostCallbackScheduled) {
        if (firstTask !== null) {
            isHostCallbackScheduled = true
            requestHostCallback(flushWork)
        } else if (firstDelayTask !== null) {
            requestHostTimeout(handleTimeout, firstDelayTask.startTime - currentTime)
        }
    }
}

function advanceTimers(currentTime: number) {
    if (firstDelayTask !== null && firstDelayTask.startTime <= currentTime) {
        do {
            const task: Task = firstDelayTask
            const next = task.next!
            if (task === null) {
                firstDelayTask = null
            } else {
                firstDelayTask = next
                const previous = task.previous!
                previous.next = next
                next.previous = previous
            }
            task.next = task.previous = null
            insertScheduledTask(task)
        } while (
            firstDelayTask !== null && firstDelayTask.startTime <= currentTime
        )
    }
}

function scheduleCallback(priority: SchedulePriority, callback: () => any, options?: { timeout: number; delay: number } ) {
    const currentTime = getCurrentTime()
    let startTime = currentTime
    let timeout = PriorityTimeout[priority]
    if (options) {
        startTime += options.delay || 0
        timeout = options.timeout || timeout
    }

    const expirationTime = startTime + timeout

    const newTask: Task = {
        callback,
        priority,
        startTime,
        expirationTime,
        next: null,
        previous: null
    }

    if (startTime > currentTime) {
        insertDelayTask(newTask)
        if (firstTask === null && firstDelayTask === newTask) {
            if (isHostTimeoutScheduled) {
                cancelHostTimeout()
            } else {
                isHostTimeoutScheduled = true
            }
            requestHostTimeout(handleTimeout, startTime - currentTime)
        }
    } else {
        insertScheduledTask(newTask)
        if (!isHostCallbackScheduled) {
            // eslint-ignore
            requestHostCallback(flushWork)
        }
    }

    return newTask
}

function pauseExecution() {
    isSchedulerPaused = true
}

function continueExecution() {
    isSchedulerPaused = false
    if (!isHostCallbackScheduled && !isPerformingWork) {
        isHostCallbackScheduled = true
        requestHostCallback(flushWork)
    }
}

function getFirstCallbackNode() {
    return firstTask
}


function cancelCallback(task: Task) {
    let next = task.next
    if (next === null) {
        return;
    }

    if (task === next) {
        if (task == firstTask) {
            firstTask = null
        } else if (task === firstDelayTask) {
            firstDelayTask = null
        }
    } else {
        if (task === firstTask) {
            firstTask = next
        } else if (task === firstDelayTask) {
            firstDelayTask = next
        }
        let previous = task.previous!
        previous.next = next
        next.previous = previous
    }
    task.next = task.previous = null
}

function getCurrentPriority() {
    return currentPriority
}

function shouldYield() {
    const currentTime = getCurrentTime()
    advanceTimers(currentTime)
    return (
        (currentTask !== null &&
        firstTask !== null &&
        firstTask.startTime <= currentTime &&
        firstTask.expirationTime < currentTask.expirationTime) || shouldYieldToHost()
    )
}

function runWithPriority(priority: SchedulePriority, eventHandler: () => void) {
    let previousPriority = currentPriority
    currentPriority = priority

    try {
        return eventHandler()
    } finally {
        currentPriority = previousPriority
    }
}

function wrapCallback(callback: (...args: any[]) => void) {
    let parentPriority = currentPriority
    return function(...args: any[]) {
        // This is a fork of runWithPriority, inlined for performance.
        var previousPriorityLevel = currentPriority;
        currentPriority = parentPriority;

        try {
          return callback.apply(null, args);
        } finally {
          currentPriority = previousPriorityLevel;
        }
      };
}

function next(eventHandler: () => void) {
    let priority
    switch (currentPriority) {
        case SchedulePriority.IMMEDIATE_PRIORITY:
        case SchedulePriority.USER_BLOCKING_PRIORITY:
        case SchedulePriority.NORMAL_PRIORITY:
            priority = SchedulePriority.NORMAL_PRIORITY
            break
        default:
            priority = currentPriority
            break
    }

    let previousPriority = currentPriority
    currentPriority = priority

    try {
        return eventHandler()
    } finally {
        currentPriority = previousPriority
    }
}

export {
    runWithPriority,
    next,
    scheduleCallback,
    cancelCallback,
    wrapCallback,
    getCurrentPriority,
    shouldYield,
    requestPaint,
    continueExecution,
    pauseExecution,
    getFirstCallbackNode,
    getCurrentTime as now,
    forceFrameRate
}
