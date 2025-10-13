import React, { isValidElement, Children } from 'react'
import RootLayout from '../layout'

describe('RootLayout', () => {
  it('wraps children in html/body scaffold with star layers', () => {
    const child = <div data-testid="content">Hello</div>
    const element = RootLayout({ children: child })

    expect(isValidElement(element)).toBe(true)
    if (!isValidElement(element)) return

    expect(element.type).toBe('html')
    expect(element.props.lang).toBe('en')

    const [, body] = element.props.children as React.ReactNode[]
    expect(isValidElement(body)).toBe(true)
    if (!isValidElement(body)) return

    const ids = Children.toArray(body.props.children)
      .filter(isValidElement)
      .map(node => (node as React.ReactElement).props.id)
      .filter(Boolean)

    expect(ids).toEqual(['stars1', 'stars2', 'stars3'])
  })
})
