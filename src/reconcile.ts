import { createRootFiberNode, createWorkInProgressRootFiberNode } from './fiber'
import { ENOUGH_TIME, ROOT_FIBER_NODE } from './constants'
import dispatcher from './dispatcher'
import { isComponent } from './utils'
import { transformElementInputsToElements } from './element'
import { FiberNode, ElementInput, FunctionComponent, Element, RootHTMLElementWithFiberNode } from '../redul'
import { EffectTag, FiberNodeTag } from '../interface'
import { setWorkInProgressFiberNode, resetWorkInProgressHook } from './hook'

let taskQueue: FiberNode[] = []

const requestIdleCallback = ((callback: (deadline: RequestIdleCallbackDeadline) => void) => {
    callback({
        didTimeout: true,
        timeRemaining: () => 100
    })
})

let nextUnitWork: FiberNode | null = null
let workInProgressRootFiberNode: FiberNode | null = null

export function render(element: ElementInput, containerDom: HTMLElement) {
    // clear all before render
    dispatcher.clearDomContent(containerDom)
    const rootFiberNode = createRootFiberNode(element, containerDom)
    taskQueue.push(rootFiberNode)

    requestIdleCallback(performWork)
    return containerDom
}

export function scheduleUpdate(fiberNode: FiberNode) {
    taskQueue.push(fiberNode)

    // when no work in progress, start immediately
    if (!nextUnitWork) {
        requestIdleCallback(performWork)
    }
}

function performWork(deadline: RequestIdleCallbackDeadline) {
    nextUnitWork = resolveNextUnitWork()
    if (!nextUnitWork) {
        commitAllWork()
        return
    }

    if (deadline.timeRemaining() > ENOUGH_TIME) {
        nextUnitWork = performUnitWork(nextUnitWork)
    }

    requestIdleCallback(performWork)
}

function resolveNextUnitWork() {
    nextUnitWork = nextUnitWork || flushTaskQueue() || null
    // update work-in-progress root fiber
    if (nextUnitWork && nextUnitWork.tag === FiberNodeTag.HOST_ROOT_NODE) {
        workInProgressRootFiberNode = nextUnitWork
    }

    return nextUnitWork
}

function flushTaskQueue() {
    const currentFiberNode = taskQueue.shift() || null
    let rootFiberNode: FiberNode | null = null

    // every update should start from a rootFiberNode
    if (currentFiberNode && currentFiberNode.tag === FiberNodeTag.COMPONENT_NODE) {
        currentFiberNode.isPartialStateChanged = true

        if (workInProgressRootFiberNode) {
            rootFiberNode = createWorkInProgressRootFiberNode(workInProgressRootFiberNode)
        }
    } else {
        rootFiberNode = currentFiberNode
    }

    return rootFiberNode
}

function commitAllWork() {
    if (workInProgressRootFiberNode) {
        // save root fiber
        (workInProgressRootFiberNode.statNode as RootHTMLElementWithFiberNode)[ROOT_FIBER_NODE] = workInProgressRootFiberNode
        dispatcher.render(workInProgressRootFiberNode)
    }
}

function performUnitWork(unitWork: FiberNode) {
    let fiberNode: FiberNode | null = unitWork
    beginUnitWork(fiberNode)

    if (fiberNode.child) {
        return fiberNode.child
    }

    while(fiberNode) {
        completeUnitWork(fiberNode)
        if (fiberNode.sibling) {
            return fiberNode.sibling
        }
        fiberNode = fiberNode.parent || null
    }

    return null
}

function beginUnitWork(fiberNode: FiberNode) {
    if (isComponent(fiberNode.type)) {
        beginComponentNodeUnitWork(fiberNode)
    } else (
        beginHostNodeUnitWork(fiberNode)
    )
}

function beginComponentNodeUnitWork(fiberNode: FiberNode) {
    const Component = fiberNode.type as FunctionComponent
    const alternateFiberNode = fiberNode.alternate

    // TODO: judge props whether equal
    console.log(fiberNode.type, alternateFiberNode && alternateFiberNode.isPartialStateChanged, alternateFiberNode && alternateFiberNode.props === fiberNode.props, alternateFiberNode && alternateFiberNode.props, fiberNode.props)
    if (alternateFiberNode && alternateFiberNode.props === fiberNode.props && !alternateFiberNode.isPartialStateChanged) {
        cloneChildFiberNodes(fiberNode)
        // reset update tag
        alternateFiberNode.isPartialStateChanged = false
    } else {
        // set work-in-progress fiber to use in hooks
        setWorkInProgressFiberNode(fiberNode)
        const children = transformElementInputsToElements(Component(fiberNode.props))
        fiberNode.isMount = true
        resetWorkInProgressHook()
        reconcileChildren(children, fiberNode)
    }
}

function cloneChildFiberNodes(parentFiberNode: FiberNode) {
    let oldFiberNode = parentFiberNode.alternate!.child
    let prevFiberNode: FiberNode | null = null

    while (oldFiberNode != null) {
        const newFiberNode = {
            ...oldFiberNode,
            // update effect tag
            effectTag: mergeEffectTag(EffectTag.NOTHING, oldFiberNode),
            alternate: oldFiberNode,
            parent: parentFiberNode,
        }

        if (prevFiberNode === null) {
            parentFiberNode.child = newFiberNode
        } else {
            (prevFiberNode as FiberNode).sibling = newFiberNode
        }

        prevFiberNode = newFiberNode
        oldFiberNode = oldFiberNode.sibling
    }
}

function beginHostNodeUnitWork(fiberNode: FiberNode) {
    const { children } = fiberNode
    reconcileChildren(children, fiberNode)
}

function reconcileChildren(children: Element[], fiberNode: FiberNode) {
    const alternateParentFiberNode = fiberNode.alternate
    // fiber node chain
    let prevChildFiberNode: FiberNode | null = null
    let alternateChildFiberNode: FiberNode | null = null
    for (let i = 0; i < children.length; i++) {
        const childElement = children[i]
        const childFiberNode = transformElementToFiberNode(childElement)
        if (i === 0) {
            fiberNode.child = childFiberNode
            alternateChildFiberNode = alternateParentFiberNode && alternateParentFiberNode.child || null
        } else {
            prevChildFiberNode!.sibling = childFiberNode
            alternateChildFiberNode = alternateChildFiberNode && alternateChildFiberNode.sibling || null
        }
        childFiberNode.parent = fiberNode
        childFiberNode.alternate = alternateChildFiberNode || null
        childFiberNode.statNode = alternateChildFiberNode && alternateChildFiberNode.statNode || null
        childFiberNode.isMount = alternateChildFiberNode && alternateChildFiberNode.isMount || false
        // copy hooks
        childFiberNode.hooks = alternateChildFiberNode && alternateChildFiberNode.hooks || null

        const effectTag = resolveEffectTag(childElement, alternateChildFiberNode)
        childFiberNode.effectTag = mergeEffectTag(effectTag, alternateChildFiberNode)

        prevChildFiberNode = childFiberNode
    }

    if (alternateChildFiberNode && alternateChildFiberNode.sibling) {
        resolveAlternateFiberNodesAsRemoveEffectTag(alternateChildFiberNode.sibling, fiberNode)
    }
}

function transformElementToFiberNode(element: Element): FiberNode {
    const fiberNode = {
        tag: isComponent(element.type) ? FiberNodeTag.COMPONENT_NODE : FiberNodeTag.HOST_NODE,
        ...element,
        effects: [],
        statNode: null
    }
    return fiberNode
}

function resolveEffectTag(element: Element, alternateFiberNode: FiberNode | null): EffectTag {
    if (alternateFiberNode) {
        if (element.type === alternateFiberNode.type) {
            if (element.props === alternateFiberNode.props) {
                return EffectTag.NOTHING
            }
            return EffectTag.UPDATE
        } else {
            return EffectTag.REPLACE
        }
    }

    return EffectTag.ADD
}

function mergeEffectTag(currentEffectTag: EffectTag, alternateFiberNode: FiberNode | null): EffectTag | null {
    // merge effect if alternateFiberNode has effectTag
    // all effectTag will be reset after render
    // so if there any effectTag in alternateFiberNode, we should merge it with currentTag
    const oldEffectTag = alternateFiberNode && alternateFiberNode.effectTag || null
    if (!oldEffectTag) {
        return currentEffectTag
    }

    if (alternateFiberNode) {
        alternateFiberNode.effectTag = EffectTag.NOTHING
    }
    return Math.max(currentEffectTag, oldEffectTag)
}

function resolveAlternateFiberNodesAsRemoveEffectTag(alternateFiberNode: FiberNode | null, fiberNode: FiberNode) {
    if (alternateFiberNode) {
        alternateFiberNode.effectTag = EffectTag.REMOVE
        fiberNode.effects.push(alternateFiberNode)
    }
}

function completeUnitWork(fiberNode: FiberNode) {
    const parentFiberNode = fiberNode.parent
    const effects = fiberNode.effects

    // commit hooks
    commitUnitWorkHooks(fiberNode)

    if (parentFiberNode) {
        if (fiberNode.effectTag) {
            parentFiberNode.effects.push(fiberNode)
        }
        parentFiberNode.effects.push(...effects)
        // reset effects
        fiberNode.effects = []
    }
}

function commitUnitWorkHooks(fiberNode: FiberNode) {
    const updateQueue = fiberNode.updateQueue || []
    // reset updateQueue
    for (let i = 0; i < updateQueue.length; i++) {
        const hookEffect = updateQueue[i]
        const { create, destroy } = hookEffect
        if (destroy) {
            destroy()
        }
        if (create) {
            hookEffect.destroy = create() || null
        }
    }
    fiberNode.updateQueue = []
}
