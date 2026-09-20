export type AddressTier = 'bahrain' | 'gcc' | 'international'

export const GCC_COUNTRY_CODES = ['SA', 'AE', 'OM', 'KW', 'QA']

export const BAHRAIN_GOVERNORATES = ['Capital', 'Muharraq', 'Northern', 'Southern']

export const GCC_REGIONS: Record<string, string[]> = {
  SA: [
    'Riyadh Province',
    'Makkah Province',
    'Eastern Province',
    'Madinah Province',
    'Asir Province',
    'Qassim Province',
    'Tabuk Province',
    'Hail Province',
    'Northern Borders Province',
    'Jazan Province',
    'Najran Province',
    'Al Bahah Province',
    'Al Jouf Province',
  ],
  AE: ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'],
  OM: [
    'Muscat',
    'Dhofar',
    'Musandam',
    'Al Buraimi',
    'Ad Dakhiliyah',
    'Al Batinah North',
    'Al Batinah South',
    'Ash Sharqiyah North',
    'Ash Sharqiyah South',
    'Adh Dhahirah',
    'Al Wusta',
  ],
  KW: ['Al Asimah', 'Hawalli', 'Farwaniya', 'Mubarak Al-Kabeer', 'Ahmadi', 'Jahra'],
  QA: ['Doha', 'Al Rayyan', 'Al Wakrah', 'Al Khor', 'Umm Salal', 'Al Daayen', 'Al Shamal', 'Al Shahaniya'],
}

export function getAddressTier(countryCode: string): AddressTier {
  if (countryCode === 'BH') return 'bahrain'
  if (GCC_COUNTRY_CODES.includes(countryCode)) return 'gcc'
  return 'international'
}
