import { FiberNode, ElementInput, RootHTMLElementWithFiberNode } from "../redul";
import { FiberNodeTag } from '../interface'
import { transformElementInputsToElements } from "./element";

export function createRootFiberNode(element: ElementInput | ElementInput[], statNode: RootHTMLElementWithFiberNode): FiberNode {
    return {
        tag: FiberNodeTag.HOST_ROOT_NODE,
        children: transformElementInputsToElements(element),
        effects: [],
        statNode,
        alternate: null
    }
}

export function createWorkInProgressRootFiberNode(fiberNode: FiberNode) {
    return {
        tag: FiberNodeTag.HOST_ROOT_NODE,
        children: fiberNode.children,
        effects: fiberNode.effects,
        statNode: fiberNode.statNode,
        alternate: fiberNode
    }
}
