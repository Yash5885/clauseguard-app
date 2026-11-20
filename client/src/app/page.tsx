import Link from 'next/link';
import {
  FileText,
  ScanText,
  ShieldCheck,
  Layers,
  BookOpen,
  Check,
  LockKeyhole,
  Scale,
} from 'lucide-react';
import { Brand } from '@/components/Brand';
import { AuthControls } from '@/components/AuthControls';
import { categories } from '@/lib/types';
export default function Home() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#reference-library">What we review</a>
        </nav>
        <div className="landing-actions">
          {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
            <AuthControls />
          ) : (
            <>
              <Link href="/sign-in" className="text-link">
                Sign in
              </Link>
              <Link href="/sign-up" className="button small">
                Get started
              </Link>
            </>
          )}
        </div>
      </header>
      <main id="main-content">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="little-line" />
              LESS UNCERTAINTY. MORE UNDERSTANDING.
            </span>
            <h1>
              Know what
              <br />
              you’re <em>signing.</em>
            </h1>
            <p>
              Big commitments live in the fine print. Get a clearer view of your contract’s risks,
              one clause at a time.
            </p>
            <div className="hero-actions">
              <Link className="button large" href="/dashboard">
                <FileText size={18} />
                Review your contract
              </Link>
              <a className="text-link" href="#how-it-works">
                See how it works
              </a>
            </div>
            <div className="hero-assurance">
              <span>
                <Check size={15} />
                PDF & DOCX
              </span>
              <span>
                <Check size={15} />
                Clause-level insights
              </span>
              <span>
                <LockKeyhole size={14} />
                Private workspace
              </span>
            </div>
          </div>
          <div
            className="hero-art"
            aria-label="Contract review covers payment, ownership, liability, and other key terms"
          >
            <div className="art-grid" />
            <div className="document-back" />
            <div className="document-front">
              <div className="document-heading">
                <span className="file-icon">
                  <FileText size={23} />
                </span>
                <span>
                  THE CONTRACT
                  <br />
                  <strong>Look a little closer.</strong>
                </span>
                <span className="doc-corner">CG</span>
              </div>
              <div className="document-line long" />
              <div className="document-line medium" />
              <div className="document-section">
                <span className="category-glyph">
                  <Layers size={18} />
                </span>
                <div>
                  <strong>Payment terms</strong>
                  <p>When, how, and how much.</p>
                </div>
                <span className="bracket">[ ]</span>
              </div>
              <div className="document-section">
                <span className="category-glyph">
                  <BookOpen size={18} />
                </span>
                <div>
                  <strong>Intellectual property</strong>
                  <p>Know what stays yours.</p>
                </div>
                <span className="bracket">[ ]</span>
              </div>
              <div className="document-section highlighted">
                <span className="category-glyph">
                  <Scale size={18} />
                </span>
                <div>
                  <strong>Liability & obligations</strong>
                  <p>Understand your exposure.</p>
                </div>
                <span className="bracket">[ ]</span>
              </div>
              <div className="document-line long" />
              <div className="document-line short" />
              <div className="document-footer">
                <ShieldCheck size={16} />A clearer perspective on every clause.
              </div>
            </div>
            <div className="floating-note">
              <span>
                <ScanText size={24} />
              </span>
              <div>
                <strong>Beyond the fine print.</strong>
                <p>Context you can put to work.</p>
              </div>
            </div>
            <span className="art-caption">YOUR NEXT SIGNATURE, BETTER INFORMED.</span>
          </div>
        </section>
        <section className="trust-strip">
          <span>BUILT FOR THE MOMENTS THAT MATTER</span>
          <p>Freelance agreements</p>
          <span className="strip-dot" />
          <p>Non-disclosure agreements</p>
          <span className="strip-dot" />
          <p>Service contracts</p>
        </section>
        <section id="how-it-works" className="how-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FROM DOCUMENT TO UNDERSTANDING</span>
              <h2>
                A better review.
                <br />
                Without the overwhelm.
              </h2>
            </div>
            <p>Get past the dense language and into the details that deserve your attention.</p>
          </div>
          <div className="feature-grid">
            <article>
              <span className="feature-icon">
                <FileText size={25} />
              </span>
              <h3>Bring your contract.</h3>
              <p>
                Upload a searchable PDF or DOCX. Your document is organized into individual clauses
                for a focused review.
              </p>
            </article>
            <article>
              <span className="feature-icon">
                <ScanText size={25} />
              </span>
              <h3>See what stands out.</h3>
              <p>
                Semantic comparisons and targeted rules flag one-sided language, unusual
                obligations, and terms worth a second look.
              </p>
            </article>
            <article>
              <span className="feature-icon">
                <ShieldCheck size={25} />
              </span>
              <h3>Understand your options.</h3>
              <p>
                Read plain-English explanations grounded in reference clauses, with suggestions for
                safer wording.
              </p>
            </article>
          </div>
        </section>
        <section id="reference-library" className="library-section">
          <div>
            <span className="eyebrow">A REFERENCE POINT FOR YOUR REVIEW</span>
            <h2>
              Eight areas.
              <br />
              Fewer blind spots.
            </h2>
            <p>
              Each clause is compared with a library of 128 curated reference clauses, from balanced
              terms to language that deserves caution.
            </p>
            <Link className="button" href="/dashboard">
              Start your first review
            </Link>
          </div>
          <div className="category-grid">
            {categories.map((category, i) => (
              <div key={category}>
                <span className="category-index">{String(i + 1).padStart(2, '0')}</span>
                <span>{category}</span>
                <Check size={15} />
              </div>
            ))}
          </div>
        </section>
        <section className="legal-note">
          <Scale size={23} />
          <div>
            <h3>Clarity supports good judgment.</h3>
            <p>
              ClauseGuard provides informational analysis, not legal advice. For decisions that
              matter, review your agreement with a qualified legal professional.
            </p>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <span>Contract clarity, by design.</span>
        <span>© {new Date().getFullYear()} ClauseGuard</span>
      </footer>
    </div>
  );
}
