import Redul from '../src/index'
const { render, useState, useReducer, useEffect, useCallback, useMemo, useRef } = Redul

const getRootNode = () => {
    document.body.innerHTML = '<div id="root"></div>'
    const $root = document.getElementById('root')
    return $root
}
const $root = getRootNode()

describe('hook test', () => {
    describe('useState', () => {
        test('init value', () => {
            function Count({ count }) {
                const [value] = useState(count)
                return <div>{value}</div>
            }

            render(<Count count={1} />, $root)
            expect($root).toMatchSnapshot()
        })

        test('dispatch with click event', () => {
            function Count({ count }) {
                const [value, setValue] = useState(count)

                return <div id="counter" onClick={() => setValue(count + 1)}>{value}</div>
            }

            render(<Count count={1} />, $root)
            const $counter = document.getElementById('counter')
            $counter.click()
            expect($root).toMatchSnapshot()
        })
    })

    describe('useReducer', () => {
        test('init value', () => {
            function reducer(state, action) {
                if (action === 'add') {
                    return state + 1
                }
                return state - 1
            }

            function Count({ count }) {
                const [state] = useReducer(reducer, count)
                return <div>{state}</div>
            }

            render(<Count count={1} />, $root)
            expect($root).toMatchSnapshot()
        })

        test('dispatch with click event', () => {
            function reducer(state, action) {
                if (action === 'add') {
                    return state + 1
                }
                return state - 1
            }

            function Count({ count }) {
                const [state, dispatch] = useReducer(reducer, count)
                return <div id="counter" onClick={() => dispatch('add')}>{state}</div>
            }

            render(<Count count={1} />, $root)
            const $counter = document.getElementById('counter')
            $counter.click()
            expect($root).toMatchSnapshot()
        })
    })

    describe('useEffect', () => {
        test('set state', () => {
            function Count({ count }) {
                const [value, setValue] = useState(count)
                useEffect(() => {
                    setValue(value + 2)
                }, [])

                return value
            }

            render(<Count count={1} />, $root)
            expect($root).toMatchSnapshot()
        })

        test('complex set state', () => {
            function Count({ count }) {
                const [value, setValue] = useState(count)
                useEffect(() => {
                    setValue(count + 2)
                }, [count])

                return value
            }

            function App() {
                const [count, setCount] = useState(1)

                useEffect(() => {
                    setCount(count + 1)
                }, [])

                return (
                    <div><Count count={count} /></div>
                )
            }

            render(<App />, $root)
            expect($root).toMatchSnapshot()
        })
    })

    describe('useMemo', () => {
        test('value never change', () => {
            function Count({ count }) {
                const [value, setValue] = useState(count)
                const result = useMemo(() => value, [])
                useEffect(() => {
                    setValue(count + 1)
                }, [ count ])

                return result
            }

            render(<Count count={1} />, $root)
            expect($root).toMatchSnapshot()
        })

        test('value change', () => {
            function Count({ count }) {
                const [value, setValue] = useState(count)
                const result = useMemo(() => value, [value])
                useEffect(() => {
                    setValue(count + 1)
                }, [ count ])

                return result
            }

            render(<Count count={1} />, $root)
            expect($root).toMatchSnapshot()
        })
    })

    describe('useCallback', () => {
        test('value never change', () => {
            function Count({ count }) {
                const [value, setValue] = useState(count)
                const fn = useCallback(() => value, [])
                useEffect(() => {
                    setValue(count + 1)
                }, [ count ])

                return fn()
            }

            render(<Count count={1} />, $root)
            expect($root).toMatchSnapshot()
        })

        test('value change', () => {
            function Count({ count }) {
                const [value, setValue] = useState(count)
                const fn = useCallback(() => value, [value])
                useEffect(() => {
                    setValue(count + 1)
                }, [ count ])

                return fn()
            }

            render(<Count count={1} />, $root)
            expect($root).toMatchSnapshot()
        })
    })

    describe('useRef', () => {
        test('init ref', () => {
            function App() {
                const ref = useRef(null)

                return <div>{ref.current}</div>
            }

            render(<App />, $root)
            expect($root).toMatchSnapshot()
        })

        test('get dom', () => {
            function Count() {
                const ref = useRef(null)

                const onClick = useCallback((e) => {
                    expect(ref.current).toBe(e.target)
                }, [ref.current])

                return <div ref={ref} id="counter" onClick={onClick}></div>
            }

            render(<Count count={1} />, $root)
            const $counter = document.getElementById('counter')
            $counter.click()
        })
    })
})
