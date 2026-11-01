import { getFluverTenant } from './fluver.js'
import type { Tenant } from './types.js'

/** Para sumar un negocio, se agrega su archivo aquí. */
const TENANTS: Array<() => Tenant> = [getFluverTenant]

const loadTenants = (): Tenant[] => TENANTS.map((load) => load())

/** Cloud API directo: el negocio se reconoce por el número que recibió el mensaje. */
export const findTenantByPhoneNumberId = (phoneNumberId: string): Tenant | undefined =>
    loadTenants().find((tenant) => tenant.whatsapp?.phoneNumberId === phoneNumberId)

/** Chatwoot: cada negocio tiene su propia URL de Agent Bot, `/webhooks/chatwoot/<id>`. */
export const findTenantById = (id: string): Tenant | undefined => loadTenants().find((tenant) => tenant.id === id)
