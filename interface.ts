// fiber effect
export enum EffectTag {
    NOTHING,
    UPDATE,
    REPLACE,
    ADD,
    REMOVE
}

export enum FiberNodeTag {
    HOST_ROOT_NODE = 1,
    HOST_NODE,
    COMPONENT_NODE
}
