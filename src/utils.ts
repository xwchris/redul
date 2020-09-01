import { FunctionComponent } from "../redul";

export function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean'
}

export function arraify<T>(value: T | T[]) {
    return Array.isArray(value) ? value : [value]
}

export function isComponent(type?: string | FunctionComponent) {
    return typeof type === 'function'
}
