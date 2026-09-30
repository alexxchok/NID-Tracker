// caseSummaryWord.ts — builds the Case Summary Word file in the official
// "NID CASE SUMMARY" template layout (QNET letterhead, Cambria 11pt, black bars).
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HorizontalPositionRelativeFrom,
  ImageRun, LevelFormat, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell,
  TableLayoutType, TableRow, TabStopType, TextRun, TextWrappingType,
  VerticalPositionRelativeFrom, WidthType, HeightRule,
} from 'docx';

const FONT = 'Cambria';
const GREY = 'BFBFBF';

// ---------- small helpers ----------
const s = (v: any) => (v === null || v === undefined ? '' : String(v));

// splits multi-line text into lines, removes any "1." / "-" / "•" the user typed
function toLines(text: any): string[] {
  return s(text)
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim())
    .filter((l) => l.length > 0);
}

function run(text: string, opts: any = {}) {
  return new TextRun({ text, font: FONT, size: 22, ...opts });
}

// paragraph used inside table cells (no extra spacing, like the template)
function cellPara(text: string, opts: any = {}, paraOpts: any = {}) {
  return new Paragraph({
    spacing: { before: 2, after: 0, line: 240 },
    ...paraOpts,
    children: text ? [run(text, opts)] : [],
  });
}

async function loadImage(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

// ---------- table-2 grid (same as the template) ----------
// 7 grid columns: 1485, 3814, 158, 1364, 1365, 1364, 1365  (total 10915)
const GRID = [1485, 3814, 158, 1364, 1365, 1364, 1365];
const LABEL_W = 1485 + 3814 + 158; // 5457 (label spans 3 columns)
const VALUE_W = 1364 + 1365 + 1364 + 1365; // 5458 (value spans 4 columns)
const FULL_W = 10915;

const greyBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: GREY },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: GREY },
  left: { style: BorderStyle.SINGLE, size: 4, color: GREY },
  right: { style: BorderStyle.SINGLE, size: 4, color: GREY },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: GREY },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: GREY },
};
const blackBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
};
const blackFill = { type: ShadingType.CLEAR, color: 'auto', fill: '000000' };

// black section bar: bold white title + optional (subtitle)
function sectionBar(title: string, subtitle?: string) {
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0, line: 259 },
      children: [run(title, { bold: true, color: 'FFFFFF' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0, line: 259 },
      children: subtitle ? [run(subtitle, { color: 'FFFFFF' })] : [],
    }),
  ];
  return new TableRow({
    cantSplit: true,
    children: [
      new TableCell({ columnSpan: 7, width: { size: FULL_W, type: WidthType.DXA }, shading: blackFill, children }),
    ],
  });
}

// "Label | value" row (label spans 3 cols, value spans 4 cols)
function labelValueRow(label: string, value: any, height = 356, boldLabel = false) {
  return new TableRow({
    height: { value: height, rule: HeightRule.ATLEAST },
    children: [
      new TableCell({
        columnSpan: 3,
        width: { size: LABEL_W, type: WidthType.DXA },
        children: [cellPara(label, boldLabel ? { bold: true } : {}), cellPara('')],
      }),
      new TableCell({
        columnSpan: 4,
        width: { size: VALUE_W, type: WidthType.DXA },
        children: [cellPara(s(value))],
      }),
    ],
  });
}

// checklist row: ✓ Label | Yes | [box] | No | [box]
function checklistRow(label: string, answer: any) {
  const a = s(answer).trim().toLowerCase();
  const isYes = a === 'yes' || a === 'y' || a === 'true';
  const isNo = a === 'no' || a === 'n' || a === 'false';
  const small = (text: string, w: number, bold = false) =>
    new TableCell({
      width: { size: w, type: WidthType.DXA },
      children: [cellPara(text, bold ? { bold: true } : {}, { alignment: AlignmentType.CENTER })],
    });
  return new TableRow({
    height: { value: 353, rule: HeightRule.ATLEAST },
    children: [
      new TableCell({
        columnSpan: 3,
        width: { size: LABEL_W, type: WidthType.DXA },
        children: [
          new Paragraph({
            numbering: { reference: 'ticks', level: 0 },
            spacing: { before: 2, after: 0, line: 240 },
            children: [run(label)],
          }),
        ],
      }),
      small('Yes', 1364),
      small(isYes ? '✓' : '', 1365, true),
      small('No', 1364),
      small(isNo ? '✓' : '', 1365, true),
    ],
  });
}

// full-width cell with a numbered list (1. 2. 3.) — restarts at 1 each time
let listInstance = 0;
function numberedListRow(text: any) {
  listInstance += 1;
  const inst = listInstance;
  const lines = toLines(text);
  const items = (lines.length ? lines : ['']).map(
    (l) =>
      new Paragraph({
        numbering: { reference: 'nums', level: 0, instance: inst },
        spacing: { before: 2, after: 0, line: 240 },
        children: l ? [run(l)] : [],
      }),
  );
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: 7,
        width: { size: FULL_W, type: WidthType.DXA },
        children: [cellPara(''), ...items, cellPara('')],
      }),
    ],
  });
}

// full-width row: bold question
function questionRow(q: string) {
  return new TableRow({
    height: { value: 366, rule: HeightRule.ATLEAST },
    children: [
      new TableCell({
        columnSpan: 7,
        width: { size: FULL_W, type: WidthType.DXA },
        children: [cellPara(q, { bold: true })],
      }),
    ],
  });
}

// full-width row: answer text (keeps the user's line breaks)
function answerRow(text: any) {
  const lines = s(text).split(/\r?\n/);
  return new TableRow({
    height: { value: 366, rule: HeightRule.ATLEAST },
    children: [
      new TableCell({
        columnSpan: 7,
        width: { size: FULL_W, type: WidthType.DXA },
        children: [...lines.map((l) => cellPara(l)), cellPara('')],
      }),
    ],
  });
}

// ACTIONS TAKEN: Date | Type of Action Taken | Remarks (spans 5)
function actionRow(date: string, type: string, remarks: string, header = false) {
  const opt = header ? { bold: true } : {};
  const pOpt = header ? { alignment: AlignmentType.CENTER } : {};
  const remarkLines = s(remarks).split(/\r?\n/);
  return new TableRow({
    height: { value: 400, rule: HeightRule.ATLEAST },
    tableHeader: header,
    children: [
      new TableCell({ width: { size: 1485, type: WidthType.DXA }, children: [cellPara(date, opt, pOpt)] }),
      new TableCell({ width: { size: 3814, type: WidthType.DXA }, children: [cellPara(type, opt, pOpt)] }),
      new TableCell({
        columnSpan: 5,
        width: { size: 5616, type: WidthType.DXA },
        children: remarkLines.map((l) => cellPara(l, opt, pOpt)),
      }),
    ],
  });
}

// ---------- main ----------
export async function downloadCaseSummaryWord(data: any, rec: any, userEmail: string) {
  listInstance = 0;
  const d = data || {};
  const c = d.complainant || {};
  const ck = d.checklist || {};
  const f = d.facts || {};
  const respondents: any[] = Array.isArray(d.respondents) && d.respondents.length ? d.respondents : [{}];
  const actions: any[] = Array.isArray(d.actions) ? d.actions.filter((a: any) => a && (a.date || a.type || a.remarks)) : [];

  // pictures from the public folder
  const logo = await loadImage('/qnet-header.png');
  const bg = await loadImage('/qnet-background.jpeg');

  // ----- HEADER (same on every page) -----
  const headerRuns1: any[] = [];
  if (bg) {
    headerRuns1.push(
      new ImageRun({
        type: 'jpg',
        data: bg,
        transformation: { width: 794, height: 1123 },
        floating: {
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
          behindDocument: true,
          zIndex: 1, // background at the very back
          allowOverlap: true,
          wrap: { type: TextWrappingType.NONE },
        },
      }),
    );
  }
  if (logo) {
    headerRuns1.push(
      new ImageRun({
        type: 'png',
        data: logo,
        transformation: { width: 363, height: 90 },
        floating: {
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.COLUMN, offset: -999490 },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: -476250 },
          behindDocument: true,
          zIndex: 2, // logo sits ON TOP of the background
          allowOverlap: true,
          wrap: { type: TextWrappingType.NONE },
        },
      }),
    );
  }
  const hTabs = [
    { type: TabStopType.CENTER, position: 4680 },
    { type: TabStopType.RIGHT, position: 9360 },
  ];
  const hFont = { font: 'Calibri', size: 28, bold: true };
  const header = new Header({
    children: [
      new Paragraph({
        tabStops: hTabs,
        spacing: { after: 0, line: 240 },
        children: [...headerRuns1, new TextRun({ text: '\t\tNETWORK INTEGRITY DEPARTMENT', ...hFont })],
      }),
      new Paragraph({
        tabStops: hTabs,
        spacing: { after: 0, line: 240 },
        children: [new TextRun({ text: '\t                                  CASE SUMMARY', ...hFont })],
      }),
    ],
  });

  // ----- FOOTER: centred page number -----
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: 22 })],
      }),
    ],
  });

  // ----- Name of PIC -----
  const picPara = new Paragraph({
    children: [run('Name of PIC: ', { bold: true }), run(s(d.pic_name))],
  });

  // ----- Table 1: Complaint Receipt Date | value | CXN No. | value -----
  const t1Cell = (text: string, w: number, black: boolean) =>
    new TableCell({
      width: { size: w, type: WidthType.DXA },
      shading: black ? blackFill : undefined,
      children: [
        new Paragraph({
          spacing: { after: 0, line: 259 },
          children: text ? [run(text, black ? { color: 'FFFFFF' } : {})] : [],
        }),
      ],
    });
  const table1 = new Table({
    width: { size: 10663, type: WidthType.DXA },
    columnWidths: [2694, 3685, 1134, 3150],
    indent: { size: -572, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    borders: blackBorders,
    rows: [
      new TableRow({
        height: { value: 408, rule: HeightRule.ATLEAST },
        children: [
          t1Cell('Complaint Receipt Date:', 2694, true),
          t1Cell(s(d.receipt_date), 3685, false),
          t1Cell('CXN No.', 1134, true),
          t1Cell(s(d.cxn_no), 3150, false),
        ],
      }),
    ],
  });

  // ----- Table 2: main form -----
  const rows: TableRow[] = [];

  rows.push(sectionBar('COMPLAINANT’S DETAILS'));
  rows.push(labelValueRow('Name', c.name));
  rows.push(labelValueRow('IRID', c.irid));
  rows.push(labelValueRow('Country', c.country));
  rows.push(labelValueRow('Team Name', c.team));
  rows.push(labelValueRow('Checklist of Requirements', '', 356, true));
  rows.push(checklistRow('Complaint Form', ck.complaint_form));
  rows.push(checklistRow('Selfie holding his/her ID copy', ck.selfie));
  rows.push(checklistRow('Evidence', ck.evidence));
  rows.push(checklistRow('Verification Call', ck.verification_call));
  rows.push(checklistRow('Consent to disclose name to Respondent', ck.consent));

  rows.push(sectionBar('ALLEGATIONS / VIOLATIONS', '(Specify the details of the violations)'));
  rows.push(numberedListRow(d.allegations));

  rows.push(sectionBar('SUMMARY OF FACTS', '(What, Who, Where and How?)'));
  rows.push(questionRow('WHAT happened?'));
  rows.push(answerRow(f.what));
  rows.push(questionRow('WHEN did it happen?'));
  rows.push(answerRow(f.when));
  rows.push(questionRow('WHERE did it happen?'));
  rows.push(answerRow(f.where));
  rows.push(questionRow('How did it happen?'));
  rows.push(answerRow(f.how));
  rows.push(questionRow('Any other IRs involved?'));
  rows.push(answerRow(f.others));

  rows.push(sectionBar('RESPONDENT(S)’ DETAILS'));
  respondents.forEach((r: any, i: number) => {
    if (respondents.length > 1) rows.push(questionRow(`Respondent ${i + 1}`));
    rows.push(labelValueRow('Name', r.name, 486));
    rows.push(labelValueRow('IRID', r.irid, 486));
    rows.push(labelValueRow('Country', r.country, 486));
    rows.push(labelValueRow('Direct Referrer Name & IRID', r.referrer, 486));
    rows.push(labelValueRow('Nearest VA upline Name & IRID', r.va_upline, 486));
    rows.push(labelValueRow('Nearest Sapphire upline Name & IRID', r.sapphire_upline, 486));
    rows.push(labelValueRow('Team Name', r.team, 486));
  });

  rows.push(sectionBar('EVIDENCE'));
  rows.push(numberedListRow(d.evidence));

  rows.push(sectionBar('NID CASE ANALYSIS & RECOMMENDATION', '(Case Analysis and Reasons for Recommendation)'));
  rows.push(numberedListRow(d.analysis));

  rows.push(sectionBar('ACTIONS TAKEN & CASE UPDATES', '(Summary of actions taken in relation to the complaint)'));
  rows.push(actionRow('Date', 'Type of Action Taken', 'Remarks', true));
  actions.forEach((a: any) => rows.push(actionRow(s(a.date), s(a.type), s(a.remarks))));
  for (let i = actions.length; i < 5; i++) rows.push(actionRow('', '', '')); // at least 5 rows, like the template

  const table2 = new Table({
    width: { size: FULL_W, type: WidthType.DXA },
    columnWidths: GRID,
    indent: { size: -714, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    borders: greyBorders,
    rows,
  });

  // ----- document -----
  const doc = new Document({
    creator: s(userEmail),
    title: `Case Summary ${s(d.cxn_no)}`,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22 },
          paragraph: { spacing: { after: 160, line: 259 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: 'nums',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } }, run: { font: FONT, size: 22 } },
            },
          ],
        },
        {
          reference: 'ticks',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '\uF0FC',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } }, run: { font: 'Wingdings', size: 22 } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720 },
          },
        },
        headers: { default: header },
        footers: { default: footer },
        children: [
          picPara,
          table1,
          new Paragraph({ children: [] }),
          table2,
          // blank area after the table — paste the evidence screenshots here
          new Paragraph({ spacing: { before: 21, after: 0, line: 240 }, children: [] }),
        ],
      },
    ],
  });

  // ----- download -----
  const blob = await Packer.toBlob(doc);
  const clean = (x: string) => x.replace(/[\\/:*?"<>|]+/g, '-').trim();
  const name = clean(
    `${s(d.cxn_no) || 'Case'} - Summary #${s(rec?.summary_no) || '1'}${rec?.title ? ' - ' + s(rec.title) : ''}.docx`,
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}