import { Hook, FiberNode, HookEffect, UpdateQueue } from "../redul";
import { scheduleUpdate } from './reconcile'

let workInProgressHook: Hook | null = null
let workInProgressFiberNode: FiberNode | null = null

let componentUpdateQueue: HookEffect[] = []

export function setWorkInProgressFiberNode(fiberNode: FiberNode) {
    workInProgressFiberNode = fiberNode
}

export function resetWorkInProgressHook() {
    if (workInProgressFiberNode) {
        // mark component fiber as mounted
        workInProgressFiberNode.updateQueue = componentUpdateQueue
    }
    workInProgressHook = null
    componentUpdateQueue = []
}

function isHookOnUpdateStage() {
    return !!(workInProgressFiberNode && workInProgressFiberNode.isMount)
}

function mountWorkInProgressHook<S>() {
    const hook: Hook<S> = {
        memoizedState: null,
        dispatch: null,
        next: null,
        update: false
    }

    if (workInProgressHook === null) {
        // first hook of hook link list
        workInProgressHook = hook
        // save in work-in-progress fiber
        if (workInProgressFiberNode) {
            workInProgressFiberNode.hooks = workInProgressHook
        }
    } else {
        workInProgressHook.next = hook
        workInProgressHook = workInProgressHook.next
    }

    return hook
}


function updateWorkInProgressHook<S>() {
    // hooks never be null
    let hook: Hook<S> | null = null
    if (workInProgressHook === null) {
        hook = workInProgressFiberNode!.hooks!
    } else {
        hook = workInProgressHook.next!
    }
    workInProgressHook = hook

    return hook
}

function isInitStateFunc<S>(initState: S | (() => S)): initState is () => S {
    return typeof initState === 'function'
}

function baseReducer<S, A>(state: S, action: A) {
    return typeof action === 'function' ? action(state) : action
}

// useState
function mountUseState<S>(initState: S | (() => S)): [S, (newState: S) => void] {
    const calcInitState = isInitStateFunc(initState) ? initState() : initState
    return mountUseReducer(baseReducer, calcInitState)
}

function updateUseState<S>(): [S | null, ((newState: S) => void) | null] {
    return updateUseReducer(baseReducer)
}

// useReducer
function mountUseReducer<S, A>(reducer: (state: S, action: A) => S, initState: S): [S, (action: A) => void] {
    const hook = mountWorkInProgressHook<S>()
    const memoizedState = hook.memoizedState = initState
    const currentFiberNode = workInProgressFiberNode
    const dispatch =  hook.dispatch = (action: A) => dispatchAction(hook, currentFiberNode, reducer(initState, action))
    return [memoizedState, dispatch]
}

function updateUseReducer<S, A>(reducer: (state: S, action: A) => S): [S | null, (action: A) => void] {
    const hook = updateWorkInProgressHook<S>()
    const currentFiberNode = workInProgressFiberNode
    const dispatch = hook.dispatch = (action: A) => dispatchAction(hook, currentFiberNode, reducer(hook.memoizedState as S, action))
    return [hook.memoizedState, dispatch]
}

// useEffect
function mountUseEffect(create: () => (() => void) | void, deps?: any[]) {
    const hook = mountWorkInProgressHook<HookEffect>()
    const nextDeps = deps === undefined ? null : deps
    hook.memoizedState = pushHookEffect(create, null, nextDeps)
}

function updateUseEffect(create: () => (() => void) | void, deps?: any[]) {
    const hook = updateWorkInProgressHook<HookEffect>()
    const nextDeps = deps === undefined ? null : deps
    const hookEffect: HookEffect | null = hook.memoizedState
    const prevDeps = hookEffect && hookEffect.deps || null

    if (!isEqualDeps(prevDeps, nextDeps)) {
        const destroy = hookEffect && hookEffect.destroy || null
        hook.memoizedState = pushHookEffect(create, destroy, nextDeps)
    }
}

// useMemo
function mountUseMemo<T>(nextCreate: () => T, deps?: any[] | null) {
    const hook = mountWorkInProgressHook<[T, any[] | null]>()
    const nextDeps = deps === undefined ? null : deps
    const nextValue = nextCreate()
    hook.memoizedState = [nextValue, nextDeps]
    return nextValue
}

function updateUseMemo<T>(nextCreate: () => T, deps?: any[] | null) {
    const hook = updateWorkInProgressHook<[T, any[] | null]>()
    const nextDeps = deps === undefined ? null : deps
    const [_, prevDeps] = hook.memoizedState!

    if (!isEqualDeps(prevDeps, nextDeps))  {
        const nextValue = nextCreate()
        hook.memoizedState = [nextValue, nextDeps]
    }
    return hook.memoizedState![0]
}

// useCallback
function mountUseCallback<T>(callback: T, deps?: any[] | null) {
    const hook = mountWorkInProgressHook<[T, any[] | null]>()
    const nextDeps = deps === undefined ? null : deps
    hook.memoizedState = [callback, nextDeps]
    return callback
}

function updateUseCallback<T>(callback: T, deps?: any[] | null) {
    const hook = updateWorkInProgressHook<[T, any[] | null]>()
    const nextDeps = deps === undefined ? null : deps
    const [_, prevDeps] = hook.memoizedState!

    if (!isEqualDeps(prevDeps, nextDeps)) {
        hook.memoizedState = [callback, nextDeps]
    }
    return hook.memoizedState![0]
}

// useRef
function mountUseRef<T>(initValue: T) {
    const hook = mountWorkInProgressHook<{current: T}>()
    const ref = { current: initValue }
    hook.memoizedState = ref
    return ref
}

function updateUseRef<T>() {
    const hook = updateWorkInProgressHook<{current: T}>()
    return hook.memoizedState
}

function isEqualDeps(prevDeps: any[] | null, nextDeps: any[] | null) {
    prevDeps = prevDeps || []
    nextDeps = nextDeps || []
    for (let i = 0; i < Math.min(prevDeps.length, nextDeps.length); i++) {
        if (Object.is(prevDeps[i], nextDeps[i])) {
            continue
        }
        return false
    }
    return true
}

function pushHookEffect(create: () => (() => void) | void, destroy: (() => void) | null, deps: any[] | null) {
    const effect: HookEffect = {
        create,
        destroy,
        deps
    }
    componentUpdateQueue.push(effect)
    return effect
}

function dispatchAction<S>(hook: Hook<S>, fiberNode: FiberNode | null, newState: S) {
    if (fiberNode) {
        hook.memoizedState = newState
        hook.update = true
        scheduleUpdate(fiberNode)
    }
}

function useState<S>(initState: S) {
    if (isHookOnUpdateStage()) {
        return updateUseState()
    }

    return mountUseState(initState)
}

function useReducer<S, A>(reducer: (state: S, action: A) => S, initState: S) {
    if (isHookOnUpdateStage()) {
        return updateUseReducer(reducer)
    }

    return mountUseReducer(reducer, initState)
}

function useEffect(create: () => (() => void) | void, deps?: any[]) {
    if (isHookOnUpdateStage()) {
        return updateUseEffect(create, deps)
    }

    return mountUseEffect(create, deps)
}

function useMemo<T>(nextCreate: () => T, deps?: any[] | null) {
    if (isHookOnUpdateStage()) {
        return updateUseMemo(nextCreate, deps)
    }

    return mountUseMemo(nextCreate, deps)
}

function useCallback<T>(callback: T, deps?: any[] | null) {
    if (isHookOnUpdateStage()) {
        return updateUseCallback(callback, deps)
    }

    return mountUseCallback(callback, deps)
}

function useRef<T>(initValue: T) {
    if (isHookOnUpdateStage()) {
        return updateUseRef()
    }

    return mountUseRef(initValue)
}

export {
    useState,
    useReducer,
    useEffect,
    useMemo,
    useCallback,
    useRef
}
