import chai from 'chai'
import spies from 'chai-spies'

chai.use(spies)

export const expect = chai.expect

interface Spy extends ChaiSpies.Spy {
  calls(fn: (...args: any) => any): unknown[][];
}

export const spy = chai.spy as Spy

spy.calls = (fn: (...args: any) => any) => {
  const meta = (fn as any).__spy

  if (!meta) {
    throw new Error('Trying to get calls of not a spy')
  }

  return meta.calls
}
