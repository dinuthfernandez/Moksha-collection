import './Policies.css'
import {
  PRIVACY_POLICY_SECTIONS,
  RETURN_POLICY_SECTIONS,
  TERMS_AND_CONDITIONS_SECTIONS,
} from '../data/policies'

const POLICY_GROUPS = [
  { title: 'Return, Exchange & Refund Policy', sections: RETURN_POLICY_SECTIONS },
  { title: 'Privacy Policy', sections: PRIVACY_POLICY_SECTIONS },
  { title: 'Terms & Conditions', sections: TERMS_AND_CONDITIONS_SECTIONS },
]

export default function Policies() {
  return (
    <div className="container policies-page">
      <div className="section-heading">
        <span className="eyebrow">Customer Care</span>
        <h1 className="section-title">Policies</h1>
      </div>

      <div className="policies-body">
        {POLICY_GROUPS.map((group) => (
          <section className="policy-group" key={group.title}>
            <h2>{group.title}</h2>
            <div className="policy-accordion-list">
              {group.sections.map((section) => (
                <details className="policy-accordion" key={section.title}>
                  <summary>{section.title}</summary>
                  <p>{section.body}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
