import { describe, expect, it } from 'vitest'
import { leerCookie, macCaida, ordenMacs, otrasMacs, secretoValido } from './enrutar.js'

describe('puerta: enrutado entre Macs', () => {
  it('sin cookie va a la principal; con cookie, a la suya primero', () => {
    expect(ordenMacs(['MAC_COMPANERA', 'MAC_LUIS'], null)).toEqual(['MAC_LUIS', 'MAC_COMPANERA'])
    expect(ordenMacs(['MAC_LUIS', 'MAC_COMPANERA'], 'MAC_COMPANERA')).toEqual(['MAC_COMPANERA', 'MAC_LUIS'])
  })
  it('ignora cookies que no son una Mac configurada y Macs sin binding', () => {
    expect(ordenMacs(['MAC_LUIS'], 'MAC_COMPANERA')).toEqual(['MAC_LUIS'])
    expect(ordenMacs(['MAC_LUIS', 'OTRA'], 'OTRA')).toEqual(['MAC_LUIS'])
  })
  it('lee la cookie entre otras', () => {
    expect(leerCookie('a=1; cs-mac=MAC_LUIS; b=2', 'cs-mac')).toBe('MAC_LUIS')
    expect(leerCookie(null, 'cs-mac')).toBeNull()
  })
  it('solo 502/504/530 cuentan como Mac caída', () => {
    expect([502, 504, 530].every(macCaida)).toBe(true)
    expect([200, 401, 503].some(macCaida)).toBe(false)
  })
})

describe('puerta: consulta interna', () => {
  it('la otra Mac es cualquiera configurada menos la que pregunta', () => {
    expect(otrasMacs(['MAC_LUIS', 'MAC_COMPANERA'], 'MAC_LUIS')).toEqual(['MAC_COMPANERA'])
    expect(otrasMacs(['MAC_LUIS'], 'MAC_LUIS')).toEqual([])
  })
  it('secreto exacto', () => {
    expect(secretoValido('x'.repeat(40), 'x'.repeat(40))).toBe(true)
    expect(secretoValido('x'.repeat(40), undefined)).toBe(false)
  })
})
