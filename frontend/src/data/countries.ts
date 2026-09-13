export interface Country {
  name: string
  code: string // ISO 3166-1 alpha-2
  dialCode: string
}

// Common list for an international delivery address form (name, ISO code, calling code).
export const COUNTRIES: Country[] = [
  { name: 'Bahrain', code: 'BH', dialCode: '+973' },
  { name: 'Saudi Arabia', code: 'SA', dialCode: '+966' },
  { name: 'United Arab Emirates', code: 'AE', dialCode: '+971' },
  { name: 'Kuwait', code: 'KW', dialCode: '+965' },
  { name: 'Qatar', code: 'QA', dialCode: '+974' },
  { name: 'Oman', code: 'OM', dialCode: '+968' },
  { name: 'India', code: 'IN', dialCode: '+91' },
  { name: 'Pakistan', code: 'PK', dialCode: '+92' },
  { name: 'Bangladesh', code: 'BD', dialCode: '+880' },
  { name: 'Sri Lanka', code: 'LK', dialCode: '+94' },
  { name: 'Nepal', code: 'NP', dialCode: '+977' },
  { name: 'Philippines', code: 'PH', dialCode: '+63' },
  { name: 'Egypt', code: 'EG', dialCode: '+20' },
  { name: 'Jordan', code: 'JO', dialCode: '+962' },
  { name: 'Lebanon', code: 'LB', dialCode: '+961' },
  { name: 'Iraq', code: 'IQ', dialCode: '+964' },
  { name: 'Turkey', code: 'TR', dialCode: '+90' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44' },
  { name: 'United States', code: 'US', dialCode: '+1' },
  { name: 'Canada', code: 'CA', dialCode: '+1' },
  { name: 'Australia', code: 'AU', dialCode: '+61' },
  { name: 'New Zealand', code: 'NZ', dialCode: '+64' },
  { name: 'Germany', code: 'DE', dialCode: '+49' },
  { name: 'France', code: 'FR', dialCode: '+33' },
  { name: 'Italy', code: 'IT', dialCode: '+39' },
  { name: 'Spain', code: 'ES', dialCode: '+34' },
  { name: 'Netherlands', code: 'NL', dialCode: '+31' },
  { name: 'Switzerland', code: 'CH', dialCode: '+41' },
  { name: 'Sweden', code: 'SE', dialCode: '+46' },
  { name: 'Ireland', code: 'IE', dialCode: '+353' },
  { name: 'Singapore', code: 'SG', dialCode: '+65' },
  { name: 'Malaysia', code: 'MY', dialCode: '+60' },
  { name: 'Indonesia', code: 'ID', dialCode: '+62' },
  { name: 'Thailand', code: 'TH', dialCode: '+66' },
  { name: 'China', code: 'CN', dialCode: '+86' },
  { name: 'Japan', code: 'JP', dialCode: '+81' },
  { name: 'South Korea', code: 'KR', dialCode: '+82' },
  { name: 'South Africa', code: 'ZA', dialCode: '+27' },
  { name: 'Kenya', code: 'KE', dialCode: '+254' },
  { name: 'Nigeria', code: 'NG', dialCode: '+234' },
  { name: 'Brazil', code: 'BR', dialCode: '+55' },
  { name: 'Mexico', code: 'MX', dialCode: '+52' },
]

export function findCountry(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code)
}
