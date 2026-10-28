import { getFluverTenant } from './fluver.js'
import type { Tenant } from './types.js'

/** Un negocio por número de WhatsApp. Para sumar otro, se agrega su archivo aquí. */
const TENANTS: Array<() => Tenant> = [getFluverTenant]

export const findTenantByPhoneNumberId = (phoneNumberId: string): Tenant | undefined =>
    TENANTS.map((load) => load()).find((tenant) => tenant.whatsapp.phoneNumberId === phoneNumberId)
