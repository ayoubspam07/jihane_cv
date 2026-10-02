import { useState, useEffect } from 'react';
import './App.css';
import { library } from '@fortawesome/fontawesome-svg-core';
import { fab } from '@fortawesome/free-brands-svg-icons';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import resumeDataFr from './assets/resumeData_fr.json';
import resumeDataEn from './assets/resumeData.json';
import CanadianCV from './CanadianCV.jsx';
import ApplicationTracker from './ApplicationTracker.jsx';

library.add(fas, fab);

function getResumeMeta(locale, page) {
  const isFr = locale === 'fr';
  const isCanada = page === 'canada';
  const pageLabel = isCanada ? (isFr ? 'CV canadien' : 'Canadian CV') : isFr ? 'CV' : 'Resume';
  const title = `Jihane Tioutiou ${pageLabel}`;
  const description = isFr
    ? `CV de Jihane Tioutiou, spécialiste senior en marketing et CRM.${isCanada ? ' Format canadien.' : ''}`
    : `Resume of Jihane Tioutiou, senior marketing and CRM specialist.${isCanada ? ' Canadian format.' : ''}`;
  const keywords = [
    'Jihane Tioutiou',
    'Marketing',
    'CRM',
    isFr ? 'CV' : 'Resume',
    isCanada ? 'Canada' : '',
  ]
    .filter(Boolean)
    .join(', ');

  return { title, description, keywords };
}

function isValidResumeData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const { basics } = data;
  if (!basics || typeof basics !== 'object') return false;
  if (typeof basics.firstName !== 'string' || typeof basics.lastName !== 'string') return false;
  const arrayFields = ['skillGroups', 'experience', 'education'];
  if (data.links !== undefined && !Array.isArray(data.links)) return false;
  if (data.languages !== undefined && !Array.isArray(data.languages)) return false;
  if (data.softSkills !== undefined && !Array.isArray(data.softSkills)) return false;
  return arrayFields.every((field) => Array.isArray(data[field]));
}

function getPromptResume(resume) {
  const {
    links: _links,
    languages: _languages,
    basics: { email: _email, phone: _phone, location: _location, ...editableBasics },
    ...editableResume
  } = resume;

  return { ...editableResume, basics: editableBasics };
}

function SectionTitle({ children }) {
  return <h2 className="section-title">{children}</h2>;
}

function getLinkIcon(link) {
  return [link.prefix ?? (link.icon === 'user' ? 'fas' : 'fab'), link.icon];
}

function getContactItems(resumeData) {
  return [
    {
      icon: 'envelope',
      value: resumeData.basics.email,
      href: `mailto:${resumeData.basics.email}`,
    },
    {
      icon: 'phone',
      value: resumeData.basics.phone,
      href: `tel:${resumeData.basics.phone.replace(/\s+/g, '')}`,
    },
    {
      icon: 'map-marker-alt',
      value: resumeData.basics.location,
    },
  ];
}

function sanitizeResumeTitle(value, fallback = '') {
  let title = typeof value === 'string' ? value.trim() : fallback;

  title = title.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  const brokenLinkStart = title.indexOf('](');
  const brokenLinkEnd = title.lastIndexOf(')');
  if (brokenLinkStart > 0 && brokenLinkEnd > brokenLinkStart) {
    title = `${title.slice(0, brokenLinkStart)} ${title.slice(brokenLinkEnd + 1)}`;
  }

  return title.replace(/\s+/g, ' ').trim() || fallback;
}

function normalizeResumeData(baseResume, resume) {
  if (!resume || typeof resume !== 'object' || Array.isArray(resume)) return baseResume;

  return {
    ...baseResume,
    ...resume,
    labels: { ...(baseResume.labels ?? {}), ...(resume.labels ?? {}) },
    basics: {
      ...(baseResume.basics ?? {}),
      ...(resume.basics ?? {}),
      title: sanitizeResumeTitle(resume.basics?.title, baseResume.basics?.title ?? ''),
      email: baseResume.basics?.email ?? '',
      phone: baseResume.basics?.phone ?? '',
      location: baseResume.basics?.location ?? '',
    },
    links: baseResume.links ?? [],
    languages: baseResume.languages ?? [],
    skillGroups: Array.isArray(resume.skillGroups) ? resume.skillGroups : (baseResume.skillGroups ?? []),
    softSkills: Array.isArray(resume.softSkills) ? resume.softSkills : (baseResume.softSkills ?? []),
    highlights: Array.isArray(resume.highlights) ? resume.highlights : (baseResume.highlights ?? []),
    experience: Array.isArray(resume.experience) ? resume.experience : (baseResume.experience ?? []),
    education: Array.isArray(resume.education) ? resume.education : (baseResume.education ?? []),
    certifications: Array.isArray(resume.certifications) ? resume.certifications : (baseResume.certifications ?? []),
  };
}

// Builds a ready-to-use prompt asking an AI to tailor the resume JSON to a job.
const DEFAULT_PROMPT_INSTRUCTIONS = `You are a world-class resume writer, career coach, and ATS (Applicant Tracking System) optimization expert with deep knowledge of tech and data hiring.

Your mission: take my resume (JSON below) and the job offer (pasted at the VERY BOTTOM of this message, after the marker line) and produce the strongest possible tailored version of my resume for that exact offer.

Hard constraints (never break these):
- Never invent employers, job titles, degrees, dates, certifications, or achievements I do not already have.
- Never fabricate metrics or results that are not already present in my resume.
- Only add skills or tools that are truthful: things the offer requires and I genuinely know or use, even if I forgot to list them, plus closely related skills that strengthen the same profile.

## STEP 1 — Analyze the job offer
- The full job description is pasted at the very bottom, after the line "=== JOB DESCRIPTION BELOW ===". Read it fully before touching the resume.
- Identify: the exact job title, seniority level, must-have skills/tools, nice-to-have skills, main responsibilities, domain/industry context, and the language of the offer.

## STEP 2 — Tailor the resume aggressively

Title & summary:
- Align basics.title with the job title, using natural, established professional and IT titles (e.g. "Data Engineer", "Data & AI Engineer", "AI Engineer", "Software Engineer") rather than awkward literal translations. Apply the same rule to experience role titles.
- Write basics.title as plain text only — never Markdown, links, URLs, JSON fragments, or encoded text.
- Rewrite basics.summary as 1-2 punchy sentences mirroring the role's top priorities, using natural professional/IT terminology (e.g. "data pipelines", "cloud", "Big Data", "analytics", "BI", "AI/ML") where truthful and relevant — never stuff keywords just for ATS.
- Keep basics.tagline as an empty string. Never add a subtitle under the title.

Skills (skillGroups):
- Build a focused skills section for THIS offer: required skills first, then strong related skills the employer would value.
- Use short, canonical skill names only (e.g. "Spark" not "Apache Spark"; "Airflow" not "Apache Airflow"). Apply the same shortening to any other technology when the shorter name is clear and widely recognized.
- Never duplicate a skill (including aliases, spelling, or case variants) — keep each skill exactly once, in the single most relevant group.
- Prefer concise terms over descriptive phrases for skill items.
- Order skills so the strongest recruiter-facing keywords for this offer appear first and are easy to notice.
- Add every skill the offer requires that I genuinely know or work with, even if missing from my current resume, and integrate it naturally into skillGroups and relevant experience bullets. Assume skills matching the offer that aren't yet listed are ones I actually use but forgot to add.
- Add adjacent or transferable skills that truthfully strengthen my fit, even when not a main requirement — but except for domain knowledge, never add a skill I have no real experience with.
- If I have few matching skills, keep the required ones I truly have first, then add my other truthful skills most likely to interest this employer.
- Use the offer's exact terminology when my resume already supports the skill under different wording.
- You may freely rename, merge, reorder, or remove skill groups.

Soft skills (softSkills):
- Keep 3-6 truthful interpersonal strengths that support the role, using concise job-relevant wording. Remove any that don't help this offer.

Experience:
- Reorder and rewrite bullets so each role speaks directly to the offer's responsibilities and requirements.
- Lead with the most relevant achievements; remove, merge, or shorten low-relevance bullets.
- Use strong action verbs and the offer's keywords wherever truthfully applicable.
- Keep existing quantified results exactly as they are; never fabricate numbers.

Formatting:
- Preserve every education[].period exactly as provided, including graduation years.

## STEP 3 — Extract the job info
From the job description, extract:
- title, company, url (or ""), location (or ""), contractType (or "")
- summary: 2-3 sentences describing the role
- missions: short bullet strings of the main responsibilities
- requirements: short bullet strings of the key qualifications
- jobDescription: a cleaned copy of the full description text

## STEP 4 — Assess my chances honestly
- qualified: true only if I meet most key requirements.
- matchScore: integer 0-100, my realistic chance of getting an interview.
- assessment: 2-3 sentences — my main strengths for this role and the main gaps.
- missingProfile: 1 concise paragraph listing the missing skills, experience, or signals in my profile for this role.

## OUTPUT FORMAT (strict)
- Return ONLY one valid JSON object, directly parseable with JSON.parse().
- Keep the EXACT same structure, keys, and data types as my resume JSON.
- Add exactly ONE extra top-level key: "application": { "title": "", "company": "", "url": "", "location": "", "contractType": "", "summary": "", "missions": [], "requirements": [], "jobDescription": "", "missingProfile": "", "qualified": false, "matchScore": 0, "assessment": "" }.
- No markdown, no code fences, no comments, no text before or after the JSON.
`;

function buildResumePrompt(resumeJson, jobOffer = '', instructions = '') {
  const resume = (resumeJson || '').trim() || '{ /* your resume JSON */ }';
  const promptInstructions = instructions.trim() || DEFAULT_PROMPT_INSTRUCTIONS;

  return `${promptInstructions}

## OFFER LANGUAGE (mandatory)
- Detect the language of the job offer below before rewriting anything.
- If the offer is in English, write the entire tailored resume in English.
- If the offer is in French, write the entire tailored resume in French.
- If the source resume JSON is in a different language, translate rewritten/generated resume text, labels, skill-group titles, summaries, and experience bullets into the offer language.
- Write all generated application fields (summary, missions, requirements, jobDescription, missingProfile, and assessment) in the offer language too.
- Keep proper names, company names, product names, and technical terms in their standard form.

## My current resume (JSON)
${resume}

## Fixed fields omitted from the JSON
- Contact information (basics.email, basics.phone, basics.location), links, and languages are managed by the application.
- Do not add these fields to the output. The application restores their fixed values automatically.
- Preserve the exact structure of the JSON provided above; the omitted fixed fields are the only exception to the general output rules.

=== JOB DESCRIPTION BELOW ===
(Everything after this line is the job description.)
${jobOffer.trim() || '(Paste the full job offer here.)'}
`;
}

function ActionBar({ locale, onLocaleChange, onDownload }) {
  return (
    <div className="resume_actions" aria-label="Resume actions">
      <div className="locale_switch" role="group" aria-label="Language switcher">
        <button
          type="button"
          className={`action_button ${locale === 'fr' ? 'is-active' : ''}`}
          onClick={() => onLocaleChange('fr')}
        >
          FR
        </button>
        <button
          type="button"
          className={`action_button ${locale === 'en' ? 'is-active' : ''}`}
          onClick={() => onLocaleChange('en')}
        >
          EN
        </button>
      </div>
      <button type="button" className="action_button action_button_primary" onClick={onDownload}>
        <FontAwesomeIcon icon={["fas", "download"]} />
        <span>{locale === 'fr' ? 'Télécharger PDF' : 'Download PDF'}</span>
      </button>
    </div>
  );
}

function Home({ resumeData, showImage = true }) {
  if (!showImage) return null;
  return (
    <section className="home" id="home">
      <div className="home_container section bd-grid">
        <div className="home_data bd-grid">
          <img src="/pictures/profile_2.jpg" className="home_img" alt={`Portrait de ${resumeData.basics.firstName} ${resumeData.basics.lastName}`} />
        </div>
      </div>
    </section>
  );
}

function ResumeNameHeader({ resumeData }) {
  return (
    <header className="resume_name_header">
      <h1 className="home_title">
        {resumeData.basics.firstName} <b>{resumeData.basics.lastName}</b>
      </h1>
      <h2 className="home_profession">{resumeData.basics.title}</h2>
    </header>
  );
}

function Contact({ resumeData }) {
  const contactItems = getContactItems(resumeData);

  return (
    <div className="contact_bar" aria-label="Contact details">
      {contactItems.map((item) =>
        item.href ? (
          <a
            className="home_link"
            href={item.href}
            key={item.value}
            target={item.href.startsWith('mailto:') || item.href.startsWith('tel:') ? undefined : '_blank'}
            rel={item.href.startsWith('mailto:') || item.href.startsWith('tel:') ? undefined : 'noopener noreferrer'}
          >
            <FontAwesomeIcon icon={["fas", item.icon]} className="home_icon" />
            <span>{item.value}</span>
          </a>
        ) : (
          <span className="home_link" key={item.value}>
            <FontAwesomeIcon icon={["fas", item.icon]} className="home_icon" />
            <span>{item.value}</span>
          </span>
        )
      )}

      {resumeData.links.map((link) => (
        <a href={link.href} target="_blank" rel="noopener noreferrer" className="social_link" key={link.label}>
          <FontAwesomeIcon icon={getLinkIcon(link)} className="social_icon" />
          <span>{link.value}</span>
        </a>
      ))}
    </div>
  );
}

function Languages({ resumeData }) {
  return (
    <section className="languages section" id="languages">
      <SectionTitle>{resumeData.labels?.languages ?? 'Languages'}</SectionTitle>
      <div className="languages_container">
        <ul className="languages_content bd-grid">
          {resumeData.languages.map((language) => (
            <li key={language.name} className="languages_name language_row">
              <span className="languages_text">{language.name}</span>
              <span className="language_level">{language.level}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Skills({ resumeData }) {
  const skillGroups = (resumeData.skillGroups ?? []).filter((group) => group.title !== 'Technology');

  return (
    <section className="skills section" id="skills">
      <SectionTitle>{resumeData.labels?.skills ?? 'Core Skills'}</SectionTitle>
      <div className="skills_groups compact_list">
        {skillGroups.map((group) => (
          <div key={group.title} className="skill_group">
            {group.title.toLocaleLowerCase() !== (resumeData.labels?.skills ?? '').toLocaleLowerCase() && <h3 className="skill_group_title">{group.title}</h3>}
            <div className="skill_chips">
              {group.items.map((item) => (
                <span className="skill_chip" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TechnologySection({ resumeData }) {
  const technology = (resumeData.skillGroups ?? []).find((group) => group.title === 'Technology');
  if (!technology?.items?.length) return null;
  return (
    <section className="technology section" id="technology">
      <SectionTitle>{resumeData.labels?.technology ?? 'Technology'}</SectionTitle>
      <ul className="technology_list">
        {technology.items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function SoftSkillsSection({ resumeData }) {
  const softSkills = resumeData.softSkills ?? [];

  if (!softSkills.length) return null;

  return (
    <section className="soft_skills section" id="soft-skills">
      <SectionTitle>{resumeData.labels?.softSkills ?? 'Soft Skills'}</SectionTitle>
      <div className="skill_chips soft_skills_chips">
        {softSkills.map((item) => (
          <span className="skill_chip" key={item}>
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function ExperienceSection({ resumeData }) {
  return (
    <section className="experience section" id="experience">
      <SectionTitle>{resumeData.labels?.experience ?? 'Experience'}</SectionTitle>
      <div className="experience_container bd-grid">
        {resumeData.experience.map((job, index) => (
          <div className="experience_content" key={`${job.company}-${job.role}`}>
            <div className="experience_time">
              <span className="experience_rounder"></span>
              {index < resumeData.experience.length - 1 && <span className="experience_line"></span>}
            </div>

            <div className="experience_data bd-grid">
              <div className="experience_header">
                <h3 className="experience_title">{job.role}</h3>
                <span className="experience_year">{job.period}</span>
              </div>
              <span className="experience_company">
                {job.company}
                {job.location && <span className="experience_location"> — {job.location}</span>}
              </span>
              <ul className="experience_description experience_list">
                {job.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EducationSection({ resumeData }) {
  return (
    <section className="education section" id="education">
      <SectionTitle>{resumeData.labels?.education ?? 'Education'}</SectionTitle>

      <div className="education_container bd-grid">
        {resumeData.education.map((item) => (
          <article className="education_item" key={`${item.degree}-${item.period}`}>
            <h3 className="education_title">{item.degree}</h3>
            <p className="education_school">{item.school}</p>
            <p className="education_meta">
              {item.period && <span className="education_period">{item.period}</span>}
              {item.location && <span>{item.location}</span>}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SummarySection({ resumeData }) {
  if (!resumeData.basics?.summary) return null;
  return (
    <section className="summary section" id="summary">
      <SectionTitle>{resumeData.labels?.summary ?? 'Profile'}</SectionTitle>
      <p className="summary_text">{resumeData.basics.summary}</p>
    </section>
  );
}

function CertificationsSection({ resumeData }) {
  const certifications = resumeData.certifications ?? [];
  if (certifications.length === 0) return null;
  return (
    <section className="certifications section" id="certifications">
      <SectionTitle>{resumeData.labels?.certifications ?? 'Certifications'}</SectionTitle>
      <ul className="certification_list">
        {certifications.map((item, index) => (
          <li className="certification_item" key={`${item.name}-${index}`}>
            {item.href ? <a href={item.href} target="_blank" rel="noreferrer" className="certification_name">{item.name}</a> : <span className="certification_name">{item.name}</span>}
            {item.provider && <span className="certification_provider">{item.provider}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function HighlightsSection({ resumeData }) {
  const highlights = resumeData.highlights ?? [];
  if (highlights.length === 0) return null;
  return (
    <section className="highlights section" id="highlights">
      <SectionTitle>{resumeData.labels?.highlights ?? 'Highlights'}</SectionTitle>
      <ul className="highlight_list">{highlights.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
    </section>
  );
}

function PageNav({ page, onPageChange, locale }) {
  return (
    <nav className="page_nav" aria-label={locale === 'fr' ? 'Navigation des CV' : 'Resume navigation'}>
      <button
        type="button"
        className={`page_nav_button ${page === 'cv' ? 'is-active' : ''}`}
        onClick={() => onPageChange('cv')}
      >
        {locale === 'fr' ? 'CV' : 'Resume'}
      </button>
      <button
        type="button"
        className={`page_nav_button ${page === 'tracker' || page === 'application' ? 'is-active' : ''}`}
        onClick={() => onPageChange('tracker')}
      >
        {locale === 'fr' ? 'Candidatures' : 'Applications'}
      </button>
    </nav>
  );
}

function FloatingTools({ locale, page, onCopy, onPaste, onCopyPrompt, onEditResume }) {
  if (page === 'tracker') return null;
  const tools = [
    { key: 'edit', icon: 'pen-to-square', label: locale === 'fr' ? 'Modifier le CV' : 'Edit resume', action: onEditResume },
    { key: 'prompt', icon: 'wand-magic-sparkles', label: locale === 'fr' ? 'Prompt IA' : 'AI prompt', action: onCopyPrompt },
    { key: 'paste', icon: 'paste', label: locale === 'fr' ? 'Coller JSON' : 'Paste JSON', action: onPaste },
    { key: 'copy', icon: 'copy', label: locale === 'fr' ? 'Copier JSON' : 'Copy JSON', action: onCopy },
  ];
  return (
    <div className="application-tools" aria-label={locale === 'fr' ? 'Outils du CV de candidature' : 'Application resume tools'}>
      <strong className="application-tools_label">{locale === 'fr' ? 'Outils du CV' : 'Resume tools'}</strong>
      {tools.map((tool) => (
        <button key={tool.key} type="button" className="application-tools_button" onClick={tool.action}>
          <FontAwesomeIcon icon={['fas', tool.icon]} />
          <span>{tool.label}</span>
        </button>
      ))}
    </div>
  );
}

function ActionToast({ message }) {
  if (!message) return null;
  const isError = /impossible|invalid|invalide|failed|échec|offline|hors ligne|not saved|n[’']a pas été|ne ressemble pas/i.test(message);
  return (
    <div className={`action_toast ${isError ? 'is-error' : 'is-success'}`} role={isError ? 'alert' : 'status'} aria-live="polite">
      <FontAwesomeIcon icon={['fas', isError ? 'triangle-exclamation' : 'circle-check']} />
      <span>{message}</span>
    </div>
  );
}

const SECTION_ORDER = ['profile', 'contact', 'skills', 'certifications', 'technology', 'languages', 'summary', 'highlights', 'softSkills', 'experience', 'education'];

const SECTION_COMPONENTS = {
  profile: Home,
  contact: Contact,
  technology: TechnologySection,
  summary: SummarySection,
  highlights: HighlightsSection,
  languages: Languages,
  skills: Skills,
  softSkills: SoftSkillsSection,
  experience: ExperienceSection,
  education: EducationSection,
  certifications: CertificationsSection,
};

// Base body font size (--normal 0.82rem at 16px root) used to show the CV text size in px.
const BASE_FONT_PX = 0.82 * 16;

const defaultCvSettings = {
  fontScale: 1,
  accent: '#171513',
  showImage: true,
  photoSize: 144,
  columns: { profile: 'left', contact: 'left', summary: 'right', highlights: 'right', languages: 'left', skills: 'left', softSkills: 'left', experience: 'right', education: 'right', certifications: 'left', technology: 'left' },
  visible: { profile: true, contact: true, summary: true, highlights: true, languages: true, skills: true, softSkills: true, experience: true, education: true, certifications: true, technology: true },
  sectionScale: { profile: 1, contact: 1, summary: 1, highlights: 1, languages: 1, skills: 1, softSkills: 1, experience: 1, education: 1, certifications: 1, technology: 1 },
};

const CANADA_FIELD_ORDER = ['name', 'title', 'location', 'phone', 'email', 'links', 'summary', 'skills', 'experience', 'education', 'languages'];

const defaultCanadaSettings = {
  fontScale: 1,
  pageMargins: { top: 12, right: 15, bottom: 12, left: 15 },
  visible: Object.fromEntries(CANADA_FIELD_ORDER.map((key) => [key, true])),
};

const COLOR_PRESETS = ['#171513', '#7d5a4e', '#315b50', '#9a6b2f', '#8d4141', '#365b83', '#66723d', '#343434'];
const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function CvCustomizer({
  locale,
  variant = 'cv',
  open,
  onToggle,
  settings,
  onSettingsChange,
  onSave,
  onReset,
  saveState,
}) {
  const fr = locale === 'fr';
  const isCanada = variant === 'canada';
  const baseFontPx = isCanada ? 10 * 4 / 3 : BASE_FONT_PX;
  const [hex, setHex] = useState('');

  const patch = (next) => onSettingsChange({ ...settings, ...next });
  const setColumn = (key, column) =>
    onSettingsChange({ ...settings, columns: { ...settings.columns, [key]: column } });
  const setVisible = (key, val) =>
    onSettingsChange({ ...settings, visible: { ...settings.visible, [key]: val } });
  const setSectionScale = (key, scale) =>
    onSettingsChange({ ...settings, sectionScale: { ...settings.sectionScale, [key]: scale } });
  const setPageMargin = (edge, value) =>
    onSettingsChange({ ...settings, pageMargins: { ...settings.pageMargins, [edge]: value } });

  const sectionLabels = fr
    ? { profile: 'Identité', contact: 'Contact', summary: 'Profil', highlights: 'Points forts', languages: 'Langues', skills: 'Compétences', softSkills: 'Compétences comportementales', experience: 'Expérience', education: 'Formation', certifications: 'Certifications', technology: 'Technology' }
    : { profile: 'Identity', contact: 'Contact', summary: 'Profile', highlights: 'Highlights', languages: 'Languages', skills: 'Skills', softSkills: 'Soft Skills', experience: 'Experience', education: 'Education', certifications: 'Certifications', technology: 'Technology' };
  const canadaFieldLabels = fr
    ? { name: 'Nom', title: 'Titre professionnel', location: 'Localisation', phone: 'Téléphone', email: 'E-mail', links: 'Liens', education: 'Formation', experience: 'Expérience', skills: 'Compétences', languages: 'Langues' }
    : { name: 'Name', title: 'Professional title', location: 'Location', phone: 'Phone', email: 'Email', links: 'Links', education: 'Education', experience: 'Experience', skills: 'Skills', languages: 'Languages' };

  function applyHex() {
    const value = hex.trim();
    if (!HEX_RE.test(value)) return;
    const full = value.length === 4
      ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
      : value;
    patch({ accent: full });
    setHex('');
  }

  const saveLabel =
    saveState === 'saving'
      ? fr ? 'Enregistrement…' : 'Saving…'
      : saveState === 'saved'
        ? fr ? 'Enregistré !' : 'Saved!'
        : saveState === 'error'
          ? fr ? 'Échec' : 'Failed'
          : fr ? 'Enregistrer' : 'Save';

  return (
    <div className="cvx-controls">
      <button
        type="button"
        className={`cvx-fab ${open ? 'is-open' : ''}`}
        onClick={onToggle}
        aria-label={fr ? 'Paramètres du CV' : 'Resume settings'}
        aria-expanded={open}
      >
        <FontAwesomeIcon icon={['fas', open ? 'xmark' : 'sliders']} />
        <span>{fr ? 'Paramètres du CV' : 'Resume settings'}</span>
      </button>
      {open && (
        <div className="cvx-panel" role="dialog" aria-label={fr ? 'Personnalisation' : 'Customization'}>
          <div className="cvx-block">
            <h3 className="cvx-title">{fr ? 'Taille du texte' : 'Text size'}</h3>
            <div className="cvx-row">
              <input
                type="range"
                min={(baseFontPx * 0.8).toFixed(1)}
                max={(baseFontPx * 1.15).toFixed(1)}
                step="0.1"
                value={(settings.fontScale * baseFontPx).toFixed(1)}
                aria-label={fr ? 'Taille du texte en pixels' : 'Text size in pixels'}
                onChange={(e) => patch({ fontScale: Number(e.target.value) / baseFontPx })}
              />
              <span className="cvx-value">
                {(settings.fontScale * baseFontPx).toFixed(1)} px
              </span>
            </div>
          </div>

          {isCanada ? (
            <div className="cvx-block">
              <h3 className="cvx-title">{fr ? 'Marges du PDF' : 'PDF margins'}</h3>
              {[
                ['top', fr ? 'Haut' : 'Top'],
                ['right', fr ? 'Droite' : 'Right'],
                ['bottom', fr ? 'Bas' : 'Bottom'],
                ['left', fr ? 'Gauche' : 'Left'],
              ].map(([edge, label]) => (
                <label className="cvx-margin-control" key={edge}>
                  <span>{label} · {settings.pageMargins[edge]} mm</span>
                  <input type="range" min="5" max="30" step="1" value={settings.pageMargins[edge]} onChange={(event) => setPageMargin(edge, Number(event.target.value))} />
                </label>
              ))}
            </div>
          ) : (
            <div className="cvx-block">
              <h3 className="cvx-title">{fr ? 'Couleur principale' : 'Accent color'}</h3>
              <div className="cvx-swatches">
                {COLOR_PRESETS.map((color) => (
                  <button key={color} type="button" className={`cvx-swatch ${settings.accent.toLowerCase() === color.toLowerCase() ? 'is-active' : ''}`} style={{ background: color }} onClick={() => patch({ accent: color })} aria-label={color} />
                ))}
              </div>
              <div className="cvx-row">
                <input className="cvx-input" type="text" value={hex} onChange={(event) => setHex(event.target.value)} placeholder="#171513" aria-label={fr ? 'Code couleur hexadécimal' : 'Hex color code'} />
                <button type="button" className="cvx-btn" onClick={applyHex}>{fr ? 'Appliquer' : 'Apply'}</button>
              </div>
            </div>
          )}

          <div className="cvx-block">
            <h3 className="cvx-title">{fr ? 'Sections affichées' : 'Visible sections'}</h3>
            {!isCanada && <label className="cvx-check">
              <input
                type="checkbox"
                checked={settings.showImage}
                onChange={(e) => patch({ showImage: e.target.checked })}
              />
              <span>{fr ? 'Photo de profil' : 'Profile photo'}</span>
            </label>}
            {!isCanada && <label className="cvx-photo-size">
              <span>{fr ? 'Taille de la photo' : 'Photo size'} · {settings.photoSize}px</span>
              <input type="range" min="100" max="240" step="1" value={settings.photoSize} onChange={(event) => patch({ photoSize: Number(event.target.value) })} disabled={!settings.showImage} />
            </label>}
            {(isCanada ? CANADA_FIELD_ORDER : SECTION_ORDER).map((key) => (
              <div className="cvx-section-control" key={key}>
              <div className="cvx-field-row">
                <label className="cvx-check">
                  <input
                    type="checkbox"
                    checked={settings.visible[key]}
                    onChange={(e) => setVisible(key, e.target.checked)}
                  />
                  <span>{isCanada ? canadaFieldLabels[key] : sectionLabels[key]}</span>
                </label>
                {!isCanada && <div className="cvx-seg" role="group" aria-label={`${sectionLabels[key]} ${fr ? 'colonne' : 'column'}`}>
                  <button type="button" className={settings.columns[key] === 'left' ? 'is-active' : ''} onClick={() => setColumn(key, 'left')} disabled={!settings.visible[key]}>{fr ? 'Gauche' : 'Left'}</button>
                  <button type="button" className={settings.columns[key] === 'right' ? 'is-active' : ''} onClick={() => setColumn(key, 'right')} disabled={!settings.visible[key]}>{fr ? 'Droite' : 'Right'}</button>
                </div>}
              </div>
              {!isCanada && <label className="cvx-zone-size">
                <span>{fr ? 'Taille' : 'Size'} · {(BASE_FONT_PX * settings.fontScale * (settings.sectionScale?.[key] ?? 1)).toFixed(1)} px</span>
                <input type="range" min={(BASE_FONT_PX * settings.fontScale * 0.75).toFixed(1)} max={(BASE_FONT_PX * settings.fontScale * 1.3).toFixed(1)} step="0.1" value={(BASE_FONT_PX * settings.fontScale * (settings.sectionScale?.[key] ?? 1)).toFixed(1)} aria-label={`${sectionLabels[key]} ${fr ? 'taille en pixels' : 'size in pixels'}`} onChange={(event) => setSectionScale(key, Number(event.target.value) / (BASE_FONT_PX * settings.fontScale))} />
              </label>}
              </div>
            ))}
          </div>

          {saveState === 'error' && <p className="cvx-error" role="alert">{fr ? 'Les réglages n’ont pas été enregistrés. Vérifiez votre connexion puis réessayez.' : 'Your settings were not saved. Check your connection and try again.'}</p>}
          <div className="cvx-actions">
            <button
              type="button"
              className="cvx-btn cvx-btn--primary"
              onClick={onSave}
              disabled={saveState === 'saving'}
            >
              <FontAwesomeIcon icon={['fas', 'floppy-disk']} /> {saveLabel}
            </button>
            <button type="button" className="cvx-btn" onClick={onReset}>
              <FontAwesomeIcon icon={['fas', 'rotate-left']} /> {fr ? 'Réinitialiser' : 'Reset'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceModal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const closeOnEscape = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="service-modal-backdrop" onMouseDown={onClose}>
      <div className={`service-modal ${wide ? 'is-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="service-modal-head">
          <h2>{title}</h2>
          <button type="button" className="service-close" onClick={onClose} aria-label="Close"><FontAwesomeIcon icon={['fas', 'xmark']} /></button>
        </header>
        <div className="service-modal-body">{children}</div>
      </div>
    </div>
  );
}

function PromptModal({ locale, resumeData, initialInstructions, initialJobOffer, onSave, onClose, onCopied }) {
  const fr = locale === 'fr';
  const [instructions, setInstructions] = useState(initialInstructions || DEFAULT_PROMPT_INSTRUCTIONS);
  const [jobOffer, setJobOffer] = useState(initialJobOffer || '');
  const prompt = buildResumePrompt(JSON.stringify(getPromptResume(resumeData), null, 2), jobOffer, instructions);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      onCopied(fr ? 'Prompt et offre copiés !' : 'Prompt and job offer copied!');
      onClose();
    } catch {
      onCopied(fr ? 'Copie impossible' : 'Copy failed');
    }
  }

  return (
    <ServiceModal title={fr ? 'Préparer le prompt IA' : 'Prepare AI prompt'} onClose={onClose} wide>
      <div className="service-form-grid prompt-grid">
        <label className="service-field">
          <span>{fr ? 'Instructions du prompt' : 'Prompt instructions'}</span>
          <textarea rows="14" value={instructions} onChange={(event) => setInstructions(event.target.value)} />
        </label>
        <label className="service-field">
          <span>{fr ? "Offre d'emploi" : 'Job offer'}</span>
          <textarea rows="14" value={jobOffer} onChange={(event) => setJobOffer(event.target.value)} placeholder={fr ? "Collez l'offre complète ici" : 'Paste the full job offer here'} />
        </label>
      </div>
      <label className="service-field">
        <span>{fr ? 'Prompt complet à copier' : 'Complete prompt to copy'}</span>
        <textarea className="prompt-preview" rows="9" value={prompt} readOnly />
      </label>
      <footer className="service-modal-actions">
        <button type="button" className="cvx-btn" onClick={() => { setInstructions(DEFAULT_PROMPT_INSTRUCTIONS); onSave(DEFAULT_PROMPT_INSTRUCTIONS); }}>{fr ? 'Prompt par défaut' : 'Default prompt'}</button>
        <button type="button" className="cvx-btn" onClick={() => onSave(instructions)}><FontAwesomeIcon icon={['fas', 'floppy-disk']} /> {fr ? 'Enregistrer le prompt' : 'Save prompt'}</button>
        <button type="button" className="cvx-btn cvx-btn--primary" onClick={copyPrompt}><FontAwesomeIcon icon={['fas', 'copy']} /> {fr ? 'Copier tout' : 'Copy all'}</button>
      </footer>
    </ServiceModal>
  );
}

function PostPasteResumeChoiceModal({ locale, onEditNow, onClose }) {
  const fr = locale === 'fr';

  return (
    <ServiceModal title={fr ? 'CV de candidature prêt' : 'Application resume ready'} onClose={onClose}>
      <div className="service-confirm-copy">
        <p>
          {fr
            ? 'La candidature a été créée avec son CV. Vous pouvez le modifier maintenant pour cette entreprise si vous le souhaitez.'
            : 'The application has been created with its resume. You can edit it now for this company if you want.'}
        </p>
      </div>
      <footer className="service-modal-actions">
        <button type="button" className="cvx-btn" onClick={onClose}>
          {fr ? 'Garder tel quel' : 'Keep as is'}
        </button>
        <button type="button" className="cvx-btn cvx-btn--primary" onClick={onEditNow}>
          <FontAwesomeIcon icon={['fas', 'pen-to-square']} /> {fr ? 'Modifier ce CV' : 'Edit this resume'}
        </button>
      </footer>
    </ServiceModal>
  );
}

const BASIC_FIELDS = ['firstName', 'lastName', 'title', 'tagline'];

function ResumeEditorModal({ locale, resumeData, onSave, onReset, onClose, saveState, mode = 'default', application }) {
  const fr = locale === 'fr';
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(resumeData)));
  const [jobFields, setJobFields] = useState({ title: application?.title ?? '', company: application?.company ?? '' });
  const isApplication = mode === 'application';
  const labels = fr
    ? { firstName: 'Prénom', lastName: 'Nom', title: 'Titre', tagline: 'Accroche', email: 'Email', phone: 'Téléphone', location: 'Localisation' }
    : { firstName: 'First name', lastName: 'Last name', title: 'Title', tagline: 'Tagline', email: 'Email', phone: 'Phone', location: 'Location' };

  const updateBasics = (field, value) => setDraft((prev) => ({ ...prev, basics: { ...prev.basics, [field]: value } }));
  const updateItem = (section, index, field, value) => setDraft((prev) => ({
    ...prev,
    [section]: (prev[section] ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
  }));
  const addItem = (section, item) => setDraft((prev) => ({ ...prev, [section]: [...(prev[section] ?? []), item] }));
  const removeItem = (section, index) => setDraft((prev) => ({ ...prev, [section]: (prev[section] ?? []).filter((_, itemIndex) => itemIndex !== index) }));

  const repeatable = (title, section, fields, emptyItem) => (
    <fieldset className="editor-section">
      <legend>{title}</legend>
      {(draft[section] ?? []).map((item, index) => (
        <div className="editor-item" key={`${section}-${index}`}>
          <div className="editor-item-head"><strong>{item.name || item.title || item.role || item.degree || `${title} ${index + 1}`}</strong><button type="button" className="service-remove" onClick={() => removeItem(section, index)} aria-label={fr ? 'Supprimer' : 'Remove'}><FontAwesomeIcon icon={['fas', 'trash']} /></button></div>
          <div className="service-form-grid">
            {fields.map(({ key, label, multiline, list }) => (
              <label className={`service-field ${multiline || list ? 'is-full' : ''}`} key={key}>
                <span>{label}</span>
                {multiline || list ? <textarea rows={multiline ? 4 : 3} value={list ? (item[key] ?? []).join('\n') : item[key] ?? ''} onChange={(event) => updateItem(section, index, key, list ? event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) : event.target.value)} /> : <input value={item[key] ?? ''} onChange={(event) => updateItem(section, index, key, event.target.value)} />}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button type="button" className="cvx-btn" onClick={() => addItem(section, emptyItem)}><FontAwesomeIcon icon={['fas', 'plus']} /> {fr ? 'Ajouter' : 'Add'} {title.toLowerCase()}</button>
    </fieldset>
  );

  return (
    <ServiceModal title={isApplication ? (fr ? 'Modifier le CV de cette candidature' : 'Edit this application resume') : (fr ? 'Modifier le CV par défaut' : 'Edit default resume')} onClose={onClose} wide>
      {isApplication && !application?.id && <div className="service-form-grid">
        <label className="service-field"><span>{fr ? 'Poste ciblé' : 'Target role'}</span><input value={jobFields.title} onChange={(event) => setJobFields({ ...jobFields, title: event.target.value })} /></label>
        <label className="service-field"><span>{fr ? 'Entreprise' : 'Company'}</span><input value={jobFields.company} onChange={(event) => setJobFields({ ...jobFields, company: event.target.value })} /></label>
      </div>}
      <fieldset className="editor-section">
        <legend>{fr ? 'Informations personnelles' : 'Personal information'}</legend>
        <div className="service-form-grid">
          {BASIC_FIELDS.map((field) => <label className="service-field" key={field}><span>{labels[field]}</span><input value={draft.basics?.[field] ?? ''} onChange={(event) => updateBasics(field, event.target.value)} /></label>)}
          <label className="service-field is-full"><span>{fr ? 'Résumé professionnel' : 'Professional summary'}</span><textarea rows="4" value={draft.basics?.summary ?? ''} onChange={(event) => updateBasics('summary', event.target.value)} /></label>
          <label className="service-field is-full"><span>{fr ? 'Points forts, un par ligne' : 'Highlights, one per line'}</span><textarea rows="4" value={(draft.highlights ?? []).join('\n')} onChange={(event) => setDraft((prev) => ({ ...prev, highlights: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) }))} /></label>
        </div>
      </fieldset>
      {repeatable(fr ? 'Groupes de compétences' : 'Skill groups', 'skillGroups', [{ key: 'title', label: fr ? 'Groupe' : 'Group' }, { key: 'items', label: fr ? 'Compétences, une par ligne' : 'Skills, one per line', list: true }], { title: '', items: [] })}
      <fieldset className="editor-section">
        <legend>{fr ? 'Compétences comportementales' : 'Soft skills'}</legend>
        <label className="service-field is-full">
          <span>{fr ? 'Une par ligne' : 'One per line'}</span>
          <textarea rows="3" value={(draft.softSkills ?? []).join('\n')} onChange={(event) => setDraft((prev) => ({ ...prev, softSkills: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) }))} />
        </label>
      </fieldset>
      {repeatable(fr ? 'Expériences' : 'Experience', 'experience', [{ key: 'role', label: fr ? 'Poste' : 'Role' }, { key: 'company', label: fr ? 'Entreprise' : 'Company' }, { key: 'location', label: fr ? 'Lieu' : 'Location' }, { key: 'period', label: fr ? 'Période' : 'Period' }, { key: 'bullets', label: fr ? 'Missions, une par ligne' : 'Bullets, one per line', list: true }], { role: '', company: '', location: '', period: '', bullets: [] })}
      {repeatable(fr ? 'Formations' : 'Education', 'education', [{ key: 'degree', label: fr ? 'Diplôme' : 'Degree' }, { key: 'school', label: fr ? 'École' : 'School' }, { key: 'location', label: fr ? 'Lieu' : 'Location' }, { key: 'period', label: fr ? 'Période' : 'Period' }], { degree: '', school: '', location: '', period: '' })}
      {repeatable('Certifications', 'certifications', [{ key: 'name', label: fr ? 'Nom' : 'Name' }, { key: 'provider', label: fr ? 'Organisme' : 'Provider' }, { key: 'href', label: 'URL' }], { name: '', provider: '', href: '' })}
      {saveState === 'error' && <p className="cvx-error" role="alert">{fr ? 'Le CV de cette candidature n’a pas été enregistré. Vérifiez votre connexion puis réessayez.' : 'This application resume was not saved. Check your connection and try again.'}</p>}
      <footer className="service-modal-actions sticky-actions">
        <button type="button" className="cvx-btn" onClick={() => { onReset(); onClose(); }}><FontAwesomeIcon icon={['fas', 'rotate-left']} /> {isApplication ? (fr ? 'Revenir au CV enregistré de la candidature' : 'Restore saved application resume') : (fr ? 'Restaurer le CV original' : 'Restore original resume')}</button>
        <button type="button" className="cvx-btn cvx-btn--primary" onClick={() => onSave(draft, jobFields)} disabled={saveState === 'saving' || (isApplication && !application?.id && (!jobFields.title.trim() || !jobFields.company.trim()))}><FontAwesomeIcon icon={['fas', 'floppy-disk']} /> {saveState === 'saving' ? (fr ? 'Enregistrement…' : 'Saving…') : isApplication ? (fr ? 'Enregistrer ce CV de candidature' : 'Save this application resume') : (fr ? 'Enregistrer comme CV par défaut' : 'Save as default resume')}</button>
      </footer>
    </ServiceModal>
  );
}

function JobInfo({ locale, job, onPrev, onNext, hasResume, saveError = false }) {
  const fr = locale === 'fr';
  const L = {
    heading: fr ? 'Poste ciblé' : 'Target job',
    prev: fr ? 'Précédent' : 'Previous',
    next: fr ? 'Suivant' : 'Next',
    missions: fr ? 'Missions' : 'Missions',
    requirements: fr ? 'Exigences' : 'Requirements',
    description: fr ? 'Description du poste' : 'Job description',
    missingProfile: fr ? 'Ce qui manque à mon profil' : 'Profile gaps',
    contract: fr ? 'Contrat' : 'Contract',
    cvUsed: fr ? 'CV utilisé chargé' : 'Used resume loaded',
    noCv: fr ? 'Aucun CV valide enregistré' : 'No valid resume stored',
    open: fr ? "Voir l'offre" : 'Open posting',
    qualified: fr ? 'Qualifié' : 'Qualified',
    notQualified: fr ? 'Non qualifié' : 'Not qualified',
    chance: fr ? "Chances d'entretien" : 'Interview chance',
    assessment: fr ? 'Évaluation' : 'Assessment',
  };
  const hasScore = typeof job.matchScore === 'number' && !Number.isNaN(job.matchScore);
  const scoreTone = !hasScore ? '' : job.matchScore >= 60 ? 'is-ok' : job.matchScore >= 35 ? 'is-warn' : 'is-bad';
  return (
    <section className="jobinfo">
      {saveError && <p className="jobinfo_error" role="alert">{fr ? 'Le CV n’a pas été enregistré. Vérifiez votre connexion puis réessayez. Vos modifications restent ouvertes.' : 'The resume was not saved. Check your connection and try again. Your edits are still open.'}</p>}
      <header className="jobinfo_head">
        <div className="jobinfo_headings">
          <span className="jobinfo_eyebrow">{L.heading}</span>
          <h2 className="jobinfo_title">{job.title}</h2>
          <p className="jobinfo_company">
            {job.company}
            {job.location ? ` — ${job.location}` : ''}
          </p>
        </div>
        <div className="jobinfo_nav">
          <button type="button" onClick={onPrev} aria-label={L.prev}>
            <FontAwesomeIcon icon={['fas', 'chevron-left']} />
          </button>
          <button type="button" onClick={onNext} aria-label={L.next}>
            <FontAwesomeIcon icon={['fas', 'chevron-right']} />
          </button>
        </div>
      </header>

      <div className="jobinfo_meta">
        <span className={`jobinfo_pill ${hasResume ? 'is-ok' : 'is-warn'}`}>
          {hasResume ? L.cvUsed : L.noCv}
        </span>
        {hasScore && (
          <span className={`jobinfo_pill jobinfo_score ${scoreTone}`}>
            {L.chance}: {job.matchScore}%
          </span>
        )}
        {typeof job.qualified === 'boolean' && (
          <span className={`jobinfo_pill ${job.qualified ? 'is-ok' : 'is-bad'}`}>
            {job.qualified ? L.qualified : L.notQualified}
          </span>
        )}
        {job.contractType && (
          <span className="jobinfo_pill">
            {L.contract}: {job.contractType}
          </span>
        )}
        {job.status && <span className="jobinfo_pill">{job.status}</span>}
        {job.url && (
          <a className="jobinfo_link" href={job.url} target="_blank" rel="noreferrer">
            {L.open} <FontAwesomeIcon icon={['fas', 'arrow-up-right-from-square']} />
          </a>
        )}
      </div>

      {hasScore && (
        <div className="jobinfo_gauge" aria-hidden="true">
          <span className={`jobinfo_gauge_fill ${scoreTone}`} style={{ width: `${job.matchScore}%` }} />
        </div>
      )}

      {job.assessment && (
        <p className="jobinfo_summary">
          <strong>{L.assessment}: </strong>
          {job.assessment}
        </p>
      )}

      {job.summary && <p className="jobinfo_summary">{job.summary}</p>}

      {Array.isArray(job.missions) && job.missions.length > 0 && (
        <div className="jobinfo_block">
          <h3>{L.missions}</h3>
          <ul>
            {job.missions.map((m, i) => (
              <li key={`m-${i}`}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(job.requirements) && job.requirements.length > 0 && (
        <div className="jobinfo_block">
          <h3>{L.requirements}</h3>
          <ul>
            {job.requirements.map((r, i) => (
              <li key={`r-${i}`}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {job.jobDescription && (
        <div className="jobinfo_block">
          <h3>{L.description}</h3>
          <p className="jobinfo_desc">{job.jobDescription}</p>
        </div>
      )}

      {job.missingProfile && (
        <div className="jobinfo_block">
          <h3>{L.missingProfile}</h3>
          <p className="jobinfo_desc">{job.missingProfile}</p>
        </div>
      )}
    </section>
  );
}

function ApplicationPageHeader({ locale, job, format, onFormatChange, onHome, onDetails }) {
  return (
    <header className="application-page-header">
      <div>
        <span className="application-page-kicker">{locale === 'fr' ? 'Candidature' : 'Application'}</span>
        <h1>{job?.title || (locale === 'fr' ? 'Candidature' : 'Application')}</h1>
        <p>{job?.company}</p>
        <div className="application-format-nav" role="group" aria-label={locale === 'fr' ? 'Format du CV' : 'Resume format'}>
          <button type="button" className={format === 'cv' ? 'is-active' : ''} onClick={() => onFormatChange('cv')}>
            {locale === 'fr' ? 'CV standard' : 'Standard resume'}
          </button>
          <button type="button" className={format === 'canada' ? 'is-active' : ''} onClick={() => onFormatChange('canada')}>
            {locale === 'fr' ? 'CV canadien' : 'Canadian resume'}
          </button>
        </div>
      </div>
      <div className="application-page-actions">
        <button type="button" className="action_button" onClick={onDetails}>
          <FontAwesomeIcon icon={['fas', 'circle-info']} />
          <span>{locale === 'fr' ? 'Détails' : 'Details'}</span>
        </button>
        <button type="button" className="action_button action_button_primary" onClick={onHome}>
          <FontAwesomeIcon icon={['fas', 'house']} />
          <span>{locale === 'fr' ? 'Retour aux candidatures' : 'Back to applications'}</span>
        </button>
      </div>
    </header>
  );
}

function AppCustome() {
  const [locale, setLocale] = useState('fr');
  const [page, setPage] = useState('cv');
  const [overrides, setOverrides] = useState({});
  const [jsonError, setJsonError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [cvSettings, setCvSettings] = useState(defaultCvSettings);
  const [cvPanelOpen, setCvPanelOpen] = useState(false);
  const [resumeEditorOpen, setResumeEditorOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [promptInstructions, setPromptInstructions] = useState(() => localStorage.getItem('resumePromptInstructions') || DEFAULT_PROMPT_INSTRUCTIONS);
  const [cvSaveState, setCvSaveState] = useState('');
  const [activeJob, setActiveJob] = useState(null);
  const [jobDetailsOpen, setJobDetailsOpen] = useState(false);
  const [jobResume, setJobResume] = useState(null);
  const [jobList, setJobList] = useState([]);
  const [applicationFormat, setApplicationFormat] = useState('cv');

  const baseResume = locale === 'fr' ? resumeDataFr : resumeDataEn;
  const baseCanada = baseResume;
  const isApplicationPage = page === 'application';
  const isCanadaView = page === 'canada' || (isApplicationPage && applicationFormat === 'canada');
  const overrideKey = isCanadaView ? `canada-${locale}` : `cv-${locale}`;
  const displayResume = normalizeResumeData(
    baseResume,
    isApplicationPage ? jobResume ?? baseResume : baseResume,
  );
  const displayCanada = normalizeResumeData(
    baseCanada,
    isApplicationPage ? jobResume ?? baseCanada : baseCanada,
  );

  const activeData = isCanadaView ? displayCanada : displayResume;

  useEffect(() => {
    let active = true;
    fetch('/api/applications')
      .then((response) => (response.ok ? response.json() : []))
      .then((applications) => {
        if (active) setJobList(Array.isArray(applications) ? applications : []);
      })
      .catch(() => {
        if (active) setJobList([]);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  // Update document metadata so the printed PDF gets a meaningful title
  // and keywords (most browsers include the title in PDF metadata).
  useEffect(() => {
    const meta = getResumeMeta(locale, isCanadaView ? 'canada' : page);
    document.title = meta.title;
    document.documentElement.lang = locale === 'fr' ? 'fr' : 'en';
    updateMeta('description', meta.description);
    updateMeta('subject', meta.title);
    updateMeta('keywords', meta.keywords);
  }, [isCanadaView, locale, page]);

  function updateMeta(name, content) {
    let element = document.querySelector(`meta[name="${name}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.name = name;
      document.head.appendChild(element);
    }
    element.content = content;
  }

  function handleDownload() {
    const previousTitle = document.title;
    const format = isCanadaView ? 'Canadian_Resume' : 'Resume';
    document.title = `${activeData.basics.firstName}_${activeData.basics.lastName}_${format}_${locale.toUpperCase()}`;
    window.addEventListener('afterprint', () => {
      document.title = previousTitle;
    }, { once: true });
    window.print();
  }

  async function handleCopy() {
    try {
      const payload = { ...activeData, metadata: getResumeMeta(locale, page) };
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setJsonError(locale === 'fr' ? 'Copié !' : 'Copied!');
      setTimeout(() => setJsonError(''), 1500);
    } catch {
      setJsonError(locale === 'fr' ? 'Copie impossible' : 'Copy failed');
    }
  }

  function handleCopyPrompt() {
    setPromptOpen(true);
  }

  function handleSavePrompt(value) {
    setPromptInstructions(value);
    localStorage.setItem('resumePromptInstructions', value);
    setJsonError(locale === 'fr' ? 'Prompt enregistré !' : 'Prompt saved!');
    setTimeout(() => setJsonError(''), 1500);
  }

  async function handleClipboardPaste() {
    if (cvSaveState === 'saving') return;
    let text;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setJsonError(locale === 'fr' ? 'Impossible de lire le presse-papiers. Autorisez son accès dans votre navigateur puis réessayez.' : 'Could not read the clipboard. Allow clipboard access in your browser and try again.');
      return;
    }
    setPasteText(text);
    if (!text.trim()) {
      setJsonError(locale === 'fr' ? 'JSON invalide : le presse-papiers est vide. Copiez le résultat de l’IA puis réessayez.' : 'Invalid JSON: your clipboard is empty. Copy the AI result and try again.');
      return;
    }
    await handlePaste(text);
  }

  async function handlePaste(text = pasteText) {
    try {
      const parsed = JSON.parse(text.trim());
      const source = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      const { application, ...resume } = source;
      if (!isValidResumeData(resume)) {
        setJsonError(locale === 'fr' ? 'Ce texte ne ressemble pas à un CV JSON. Copiez le CV complet puis réessayez.' : 'This does not look like resume JSON. Copy the full resume and try again.');
        return;
      }
      if (!activeJob) {
        const job = {
          ...(application && typeof application === 'object' && !Array.isArray(application) ? application : {}),
          id: null,
          title: typeof application?.title === 'string' ? application.title.trim() : '',
          company: typeof application?.company === 'string' ? application.company.trim() : '',
          status: 'Saved',
        };
        if (!job.title || !job.company) {
          setJsonError(locale === 'fr' ? 'JSON invalide : ajoutez application.title et application.company au résultat pour enregistrer la candidature.' : 'Invalid JSON: include application.title and application.company to save the application.');
          return;
        }
        const tailoredResume = normalizeResumeData(baseResume, resume);
        startApplicationDraft(tailoredResume, job);
        setPasteOpen(false);
        setResumeEditorOpen(false);
        const saved = await persistApplicationResume(tailoredResume, {}, job);
        setJsonError(saved
          ? (locale === 'fr' ? 'La candidature et son CV ont été enregistrés.' : 'The application and its resume have been saved.')
          : (locale === 'fr' ? 'La candidature n’a pas été enregistrée. Votre CV reste ouvert ; vérifiez la connexion puis réessayez.' : 'The application was not saved. Your resume remains open; check your connection and try again.'));
        if (saved) setTimeout(() => setJsonError(''), 3500);
        return;
      }
      const tailoredResume = normalizeResumeData(isCanadaView ? baseCanada : baseResume, resume);
      const saved = await persistApplicationResume(tailoredResume);
      if (saved) setPasteOpen(false);
      setJsonError(saved
        ? (locale === 'fr' ? 'Le CV de cette candidature a été mis à jour.' : 'This application resume has been updated.')
        : (locale === 'fr' ? 'Le CV n’a pas été enregistré. Vérifiez la connexion et réessayez.' : 'The resume was not saved. Check your connection and try again.'));
      setTimeout(() => setJsonError(''), 3500);
    } catch {
      setJsonError(locale === 'fr' ? 'JSON invalide. Collez uniquement le résultat JSON complet, sans bloc Markdown.' : 'Invalid JSON. Paste only the complete JSON result, without Markdown fences.');
    }
  }

  // Load saved customization for this resume variant; otherwise fall back to defaults.
  useEffect(() => {
    if (page === 'tracker') return undefined;
    let active = true;
    const defaults = isCanadaView ? defaultCanadaSettings : defaultCvSettings;
    setCvSettings(defaults);
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[overrideKey];
      return next;
    });
    fetch(`/api/cv-settings/${encodeURIComponent(overrideKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (data.settings) {
          setCvSettings(isCanadaView
            ? {
                ...defaultCanadaSettings,
                ...data.settings,
                pageMargins: { ...defaultCanadaSettings.pageMargins, ...(data.settings.pageMargins ?? {}) },
                visible: { ...defaultCanadaSettings.visible, ...(data.settings.visible ?? {}) },
              }
            : {
                ...defaultCvSettings,
                ...data.settings,
                accent: data.settings.accent?.toLowerCase() === '#12467c' ? defaultCvSettings.accent : (data.settings.accent ?? defaultCvSettings.accent),
                photoSize: data.settings.photoSize === 96 ? defaultCvSettings.photoSize : (data.settings.photoSize ?? defaultCvSettings.photoSize),
                columns: { ...defaultCvSettings.columns, ...(data.settings.columns ?? {}), contact: 'left' },
                visible: { ...defaultCvSettings.visible, ...(data.settings.visible ?? {}) },
                sectionScale: { ...defaultCvSettings.sectionScale, ...(data.settings.sectionScale ?? {}) },
              });
        }
        if (data.overrides) {
          setOverrides((prev) => ({ ...prev, [overrideKey]: data.overrides }));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [overrideKey, page, isCanadaView]);

  async function persistCv(resume = overrides[overrideKey] ?? null, targetKey = overrideKey) {
    setCvSaveState('saving');
    try {
      const res = await fetch(`/api/cv-settings/${encodeURIComponent(targetKey)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: cvSettings, overrides: resume }),
      });
      if (!res.ok) throw new Error('save failed');
      setCvSaveState('saved');
      setTimeout(() => setCvSaveState(''), 1500);
    } catch {
      setCvSaveState('error');
    }
  }

  function handleSaveCv() {
    persistCv();
  }

  async function persistApplicationResume(resume, jobFields = {}, job = activeJob) {
    if (!job) return false;
    const fixedResume = normalizeResumeData(isCanadaView ? baseCanada : baseResume, resume);
    setJobResume(fixedResume);
    setCvSaveState('saving');
    try {
      const res = await fetch(job.id ? `/api/applications/${encodeURIComponent(job.id)}` : '/api/applications', {
        method: job.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...job, ...(!job.id ? jobFields : {}), resumeJson: JSON.stringify(fixedResume, null, 2) }),
      });
      if (!res.ok) throw new Error('save failed');
      const updated = await res.json();
      setActiveJob(updated);
      setJobResume(fixedResume);
      setJobList((prev) => prev.some((item) => item.id === updated.id)
        ? prev.map((item) => item.id === updated.id ? updated : item)
        : [updated, ...prev]);
      setRefreshKey((key) => key + 1);
      setCvSaveState('saved');
      setTimeout(() => setCvSaveState(''), 1500);
      return true;
    } catch {
      setCvSaveState('error');
      return false;
    }
  }

  function restoreApplicationResume() {
    if (!activeJob) return;
    try {
      const savedResume = JSON.parse(activeJob.resumeJson || '');
      if (isValidResumeData(savedResume)) setJobResume(savedResume);
    } catch {
      setJobResume(null);
    }
  }

  function handleSaveResume(resume, jobFields) {
    if (activeJob) {
      persistApplicationResume(resume, jobFields);
      return;
    }
    const fixedResume = normalizeResumeData(isCanadaView ? baseCanada : baseResume, resume);
    setOverrides((prev) => ({ ...prev, [overrideKey]: fixedResume }));
    setJobResume(null);
    persistCv(fixedResume);
  }

  async function handleResetCv() {
    const defaults = isCanadaView ? defaultCanadaSettings : defaultCvSettings;
    setCvSettings(defaults);
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[overrideKey];
      return next;
    });
    setJobResume(null);
    setCvSaveState('saving');
    try {
      const res = await fetch(`/api/cv-settings/${encodeURIComponent(overrideKey)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: defaults, overrides: null }),
      });
      if (!res.ok) throw new Error('reset failed');
      setCvSaveState('saved');
      setTimeout(() => setCvSaveState(''), 1500);
    } catch {
      setCvSaveState('error');
    }
  }

  function startApplicationDraft(resume = baseResume, application = {}) {
    setActiveJob({ ...application, id: null, title: application?.title || resume.basics.title, company: application?.company || '', status: 'Saved' });
    setJobResume(resume);
    setCvPanelOpen(false);
    setCvSaveState('');
    setApplicationFormat('cv');
    setPage('application');
  }

  function openResumeEditor() {
    if (!activeJob) startApplicationDraft();
    setResumeEditorOpen(true);
  }

  // Opens an applied job: loads the exact resume that was used and shows its details.
  function selectJob(app) {
    setActiveJob(app);
    setCvPanelOpen(false);
    let parsed = null;
    try {
      const data = JSON.parse(app.resumeJson || '');
      if (isValidResumeData(data)) parsed = data;
    } catch {
      parsed = null;
    }
    setJobResume(parsed);
    setApplicationFormat('cv');
    setPage('application');
    setJobDetailsOpen(false);
  }

  function clearJob(nextPage = 'cv') {
    setActiveJob(null);
    setCvPanelOpen(false);
    setJobResume(null);
    setJobDetailsOpen(false);
    setApplicationFormat('cv');
    setPage(nextPage);
  }

  function stepJob(delta) {
    if (!activeJob || jobList.length === 0) return;
    const idx = jobList.findIndex((a) => a.id === activeJob.id);
    if (idx === -1) return;
    const next = jobList[(idx + delta + jobList.length) % jobList.length];
    selectJob(next);
  }

  const effectiveSettings = isCanadaView
    ? {
        ...defaultCanadaSettings,
        ...cvSettings,
        pageMargins: { ...defaultCanadaSettings.pageMargins, ...(cvSettings.pageMargins ?? {}) },
        visible: { ...defaultCanadaSettings.visible, ...(cvSettings.visible ?? {}) },
      }
    : {
        ...defaultCvSettings,
        ...cvSettings,
        columns: { ...defaultCvSettings.columns, ...(cvSettings.columns ?? {}) },
        visible: { ...defaultCvSettings.visible, ...(cvSettings.visible ?? {}) },
        sectionScale: { ...defaultCvSettings.sectionScale, ...(cvSettings.sectionScale ?? {}) },
      };
  const leftSections = SECTION_ORDER.filter(
    (key) => effectiveSettings.visible[key] && effectiveSettings.columns?.[key] === 'left',
  );
  const rightSections = SECTION_ORDER.filter(
    (key) => effectiveSettings.visible[key] && effectiveSettings.columns?.[key] === 'right',
  );

  return (
    <div className="app_frame">
      <ActionToast message={jsonError} />
      <main className="l-main bd-container">
        <PageNav
          page={page}
          onPageChange={(nextPage) => {
            if (nextPage === 'cv') clearJob();
            else {
              setActiveJob(null);
              setJobResume(null);
              setPage(nextPage);
            }
          }}
          locale={locale}
        />
        {page !== 'tracker' && (
          <ActionBar
            locale={locale}
            onLocaleChange={setLocale}
            onDownload={handleDownload}
          />
        )}
        {page !== 'tracker' && <FloatingTools locale={locale} page={page} onCopy={handleCopy} onPaste={handleClipboardPaste} onCopyPrompt={handleCopyPrompt} onEditResume={openResumeEditor} />}
        {page !== 'tracker' && pasteOpen && <ServiceModal title={locale === 'fr' ? 'Coller JSON' : 'Paste JSON'} onClose={() => setPasteOpen(false)} wide>
          <label className="service-field"><span>{locale === 'fr' ? 'CV JSON adapté' : 'Tailored resume JSON'}</span><textarea rows="16" value={pasteText} onChange={(event) => setPasteText(event.target.value)} autoFocus /></label>
          <footer className="service-modal-actions"><button type="button" className="cvx-btn cvx-btn--primary" disabled={!pasteText.trim() || cvSaveState === 'saving'} onClick={() => handlePaste()}>{locale === 'fr' ? 'Utiliser ce CV' : 'Use this resume'}</button></footer>
        </ServiceModal>}
        {page !== 'tracker' && promptOpen && <PromptModal locale={locale} resumeData={baseResume} initialInstructions={promptInstructions} initialJobOffer={activeJob?.jobDescription ?? ''} onSave={handleSavePrompt} onClose={() => setPromptOpen(false)} onCopied={(message) => { setJsonError(message); setTimeout(() => setJsonError(''), 1800); }} />}
        {page !== 'tracker' && (
          <CvCustomizer
            locale={locale}
            variant={isCanadaView ? 'canada' : 'cv'}
            open={cvPanelOpen}
            onToggle={() => setCvPanelOpen((o) => !o)}
            settings={effectiveSettings}
            onSettingsChange={setCvSettings}
            onSave={handleSaveCv}
            onReset={handleResetCv}
            saveState={cvSaveState}
          />
        )}
        {page === 'cv' ? (
          <>
            {resumeEditorOpen && <ResumeEditorModal locale={locale} resumeData={displayResume} onSave={handleSaveResume} onReset={() => {
              if (activeJob) {
                if (jobResume) {
                  setJobResume(jobResume);
                }
                return;
              }
              handleResetCv();
            }} onClose={() => setResumeEditorOpen(false)} saveState={cvSaveState} mode={activeJob ? 'application' : 'default'} />}
            {activeJob && (
              <div className="active-job-toolbar" aria-label={locale === 'fr' ? 'CV de candidature' : 'Application resume'}>
                <button type="button" className="action_button" onClick={() => setJobDetailsOpen(true)}><FontAwesomeIcon icon={['fas', 'circle-info']} /><span>{locale === 'fr' ? 'Détails de la candidature' : 'Application details'}</span></button>
                <button type="button" className="action_button" onClick={() => setResumeEditorOpen(true)}><FontAwesomeIcon icon={['fas', 'pen-to-square']} /><span>{locale === 'fr' ? 'Modifier ce CV' : 'Edit this resume'}</span></button>
                <button type="button" className="action_button" onClick={clearJob}><FontAwesomeIcon icon={['fas', 'rotate-left']} /><span>{locale === 'fr' ? 'Revenir au CV par défaut' : 'Return to default resume'}</span></button>
              </div>
            )}
            {activeJob && jobDetailsOpen && (
              <ServiceModal title={locale === 'fr' ? 'Détails de la candidature' : 'Application details'} onClose={() => setJobDetailsOpen(false)} wide>
              <JobInfo
                locale={locale}
                job={activeJob}
                hasResume={!!jobResume}
                saveError={cvSaveState === 'error'}
                onPrev={() => stepJob(-1)}
                onNext={() => stepJob(1)}
              />
              </ServiceModal>
            )}
            <div className="cv-preview">
              <div
                className="resume"
                id="area-cv"
                style={{
                  '--cv-font-scale': effectiveSettings.fontScale,
                  '--photo-size': `${effectiveSettings.photoSize ?? 96}px`,
                  '--accent': effectiveSettings.accent,
                  '--accent-strong': effectiveSettings.accent,
                }}
              >
                <aside className="resume_left">
                  {effectiveSettings.visible.profile && <Home resumeData={displayResume} showImage={effectiveSettings.showImage} />}
                  {effectiveSettings.visible.profile && <ResumeNameHeader resumeData={displayResume} />}
                  {leftSections.filter((key) => key !== 'profile').map((key) => {
                    const Section = SECTION_COMPONENTS[key];
                    return <div className="cv-section-zone" style={{ '--section-scale': effectiveSettings.sectionScale[key] }} key={key}><Section resumeData={displayResume} showImage={effectiveSettings.showImage} column="left" /></div>;
                  })}
                </aside>
                <section className="resume_right">
                  {rightSections.filter((key) => key !== 'profile').map((key) => {
                    const Section = SECTION_COMPONENTS[key];
                    return <div className="cv-section-zone" style={{ '--section-scale': effectiveSettings.sectionScale[key] }} key={key}><Section resumeData={displayResume} showImage={effectiveSettings.showImage} column="right" /></div>;
                  })}
                </section>
              </div>
            </div>
          </>
        ) : page === 'application' ? (
          <section className="application-page">
            {activeJob ? (
              <>
                {resumeEditorOpen && (
                  <ResumeEditorModal
                    locale={locale}
                    resumeData={isCanadaView ? displayCanada : displayResume}
                    onSave={handleSaveResume}
                    onReset={() => { restoreApplicationResume(); setResumeEditorOpen(false); }}
                    onClose={() => setResumeEditorOpen(false)}
                    saveState={cvSaveState}
                    mode="application"
                    application={activeJob}
                  />
                )}
                <ApplicationPageHeader
                  locale={locale}
                  job={activeJob}
                  format={applicationFormat}
                  onFormatChange={setApplicationFormat}
                  onHome={() => clearJob('tracker')}
                  onDetails={() => setJobDetailsOpen(true)}
                />
                {jobDetailsOpen && (
                  <ServiceModal title={locale === 'fr' ? 'Détails de la candidature' : 'Application details'} onClose={() => setJobDetailsOpen(false)} wide>
                    <JobInfo
                      locale={locale}
                      job={activeJob}
                      hasResume={!!jobResume}
                      saveError={cvSaveState === 'error'}
                      onPrev={() => stepJob(-1)}
                      onNext={() => stepJob(1)}
                    />
                  </ServiceModal>
                )}
                {isCanadaView ? (
                  <CanadianCV resumeData={displayCanada} locale={locale} settings={effectiveSettings} />
                ) : (
                  <div className="cv-preview">
                    <div
                      className="resume"
                      id="area-cv"
                      style={{
                        '--cv-font-scale': effectiveSettings.fontScale,
                        '--photo-size': `${effectiveSettings.photoSize ?? 96}px`,
                        '--accent': effectiveSettings.accent,
                        '--accent-strong': effectiveSettings.accent,
                      }}
                    >
                      <aside className="resume_left">
                        {effectiveSettings.visible.profile && <Home resumeData={displayResume} showImage={effectiveSettings.showImage} />}
                        {effectiveSettings.visible.profile && <ResumeNameHeader resumeData={displayResume} />}
                        {leftSections.filter((key) => key !== 'profile').map((key) => {
                          const Section = SECTION_COMPONENTS[key];
                          return <div className="cv-section-zone" style={{ '--section-scale': effectiveSettings.sectionScale[key] }} key={key}><Section resumeData={displayResume} showImage={effectiveSettings.showImage} column="left" /></div>;
                        })}
                      </aside>
                      <section className="resume_right">
                        {rightSections.filter((key) => key !== 'profile').map((key) => {
                          const Section = SECTION_COMPONENTS[key];
                          return <div className="cv-section-zone" style={{ '--section-scale': effectiveSettings.sectionScale[key] }} key={key}><Section resumeData={displayResume} showImage={effectiveSettings.showImage} column="right" /></div>;
                        })}
                      </section>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="application-empty">{locale === 'fr' ? 'Sélectionnez une candidature.' : 'Select an application.'}</p>
            )}
          </section>
        ) : (
          <ApplicationTracker
            locale={locale}
            defaultResume={baseResume}
            refreshKey={refreshKey}
            onOpenApplication={selectJob}
          />
        )}
      </main>
    </div>
  );
}

export default AppCustome;
