import './Policies.css'

export default function Policies() {
  return (
    <div className="container policies-page">
      <div className="section-heading">
        <span className="eyebrow">Customer Care</span>
        <h1 className="section-title">Return, Exchange &amp; Refund Policy</h1>
        <p className="section-subtitle">
          At Moksha Collections, every piece is checked by hand before it reaches you. If something isn't right,
          we'll make it right.
        </p>
      </div>

      <div className="policies-body">
        <section>
          <h2>When We Accept a Return</h2>
          <p>
            We accept returns where an item arrives faulty, damaged, incorrect, or not as described. In line with
            Bahrain's Consumer Protection Law, you may request a return for any of these reasons within 15 days of
            receiving your order.
          </p>
        </section>

        <section>
          <h2>Change Of Mind</h2>
          <p>
            We do not offer refunds for change of mind, sizing, or preference. Instead, we're happy to arrange an
            exchange for another piece, or issue a credit note toward a future order, subject to the condition
            below. For change-of-mind exchanges, return delivery is arranged at the customer's cost.
          </p>
        </section>

        <section>
          <h2>How To Reach Us</h2>
          <p>
            Message our concierge on WhatsApp at{' '}
            <a href="https://wa.me/97335521619" target="_blank" rel="noreferrer">
              +973 3552 1619
            </a>{' '}
            within 48 hours of delivery, with a short photo or video of the issue. This helps us resolve things
            quickly — usually the same day.
          </p>
        </section>

        <section>
          <h2>Your Remedy</h2>
          <p>
            For an eligible return — a faulty, damaged, incorrect, or misdescribed item — you may choose an
            exchange, a replacement of the same item where available, or a credit note. Should you prefer a refund
            of the amount paid, this is honoured in line with Bahrain's Consumer Protection Law and returned to your
            original account, typically within 7 business days.
          </p>
        </section>

        <section>
          <h2>Exchanges</h2>
          <p>
            Where you exchange for an item of higher value, the difference is settled before dispatch; where the new
            item is of lower value, the balance is issued as a credit note. Exchanges are subject to availability.
          </p>
        </section>

        <section>
          <h2>Credit Notes</h2>
          <p>
            Credit notes are issued for the full value of the returned item and do not expire. They can be applied
            to any future order and used across more than one purchase until the balance is spent.
          </p>
        </section>

        <section>
          <h2>Condition</h2>
          <p>Items should be returned unworn, unwashed, and with tags attached and original packaging intact.</p>
        </section>

        <section>
          <h2>Return Delivery</h2>
          <p>
            Where the fault is ours — a damaged, incorrect, or misdescribed item — we cover the cost of return
            delivery. For change-of-mind returns and exchanges, return delivery is at the customer's cost.
          </p>
        </section>

        <section>
          <h2>A Note On Hygiene</h2>
          <p>For hygiene reasons, pierced earrings cannot be returned or exchanged unless they arrive faulty.</p>
        </section>

        <p className="policies-closing">Questions before you buy? Our concierge is always a message away.</p>
      </div>
    </div>
  )
}
