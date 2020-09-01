import { isBoolean, arraify } from "./utils";
import { TEXT_ELEMENT_TYPE } from './constants'
import { ElementType, ElementInput, Element, ElementProps } from '../redul'

// create element node
export function createElement(type: ElementType, initProps: ElementProps, ...args: ElementInput[]): Element {
    const props = Object.assign({}, initProps);
    const children = transformElementInputsToElements(args)

    props.children = children;
    return { type, props, children };
}

function createTextElement(text: string | number): Element<{nodeValue: string | number}> {
    return {
        type: TEXT_ELEMENT_TYPE,
        props: { nodeValue: text, children: [] },
        children: []
    }
}

export function transformElementInputsToElements(args: ElementInput | ElementInput[]) {
    const eles = arraify(args)
    const rawElements = ([] as ElementInput[]).concat(...eles).filter(element => element != null && !isBoolean(element)) as (string | number | Element)[];
    return rawElements.map(element => element instanceof Object ? element : createTextElement(element));
}
