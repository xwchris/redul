import Redul from '../src/index'
const { render} = Redul

const getRootNode = () => {
    document.body.innerHTML = '<div id="root"></div>'
    const $root = document.getElementById('root')
    return $root
}
const $root = getRootNode()

describe('fiber reconcile test', () => {
    describe('mount stage', () => {
        test('element string type', () => {

            render(<div className="test" style={{color: 'red'}}></div>, $root)
            expect($root).toMatchSnapshot()
        })

        test('element function type', () => {
            function Count({ count }) {
                return <div>{count}</div>
            }

            render(<Count count={1} />, $root)
            expect($root).toMatchSnapshot()
        })

        test('element complex function type', () => {
            function App() {
                return <div><Count count={1} /></div>
            }

            function Count({ count }) {
                return <span>{count}</span>
            }

            render(<App />, $root)
            expect($root).toMatchSnapshot()
        })
    })
})
