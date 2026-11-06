import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDownLeft, ArrowDownRight, ArrowRight, ArrowUpRight,
  Activity, BarChart3, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp,
  Clock3, Copy, Download, ExternalLink, Globe2, Info, Layers3, LayoutDashboard,
  Menu, Newspaper, Radio, RefreshCw, Search, ShieldCheck, Sparkles, Target,
  TrendingDown, TrendingUp, WifiOff, X, Zap,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DailyAnalysis, Dashboard, Mode, NewsItem, View } from './types'
import { isGitHubPages, loadArchive, loadDashboard } from './data'

const number = (n: number, digits = 0) => new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
const money = (n: number, digits = 0) => `$${number(n, digits)}`
const compact = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n)
const percent = (n: number) => `${n >= 0 ? '+' : ''}${number(n, 2)}%`
const clock = (time: string | number) => new Date(time).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })
const date = (time: string | number, short = false) => new Date(time).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: short ? 'short' : 'long', ...(short ? {} : { year: 'numeric' }) })
const age = (time: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(time)) / 60000))
  return minutes < 1 ? 'Baru saja' : minutes < 60 ? `${minutes} menit lalu` : minutes < 1440 ? `${Math.floor(minutes / 60)} jam lalu` : `${Math.floor(minutes / 1440)} hari lalu`
}
const views: { id: View; name: string; icon: typeof Activity }[] = [
  { id: 'overview', name: 'Ringkasan pasar', icon: LayoutDashboard },
  { id: 'analysis', name: 'Analisis harian', icon: BarChart3 },
  { id: 'activity', name: 'Aktivitas pasar', icon: Activity },
  { id: 'news', name: 'Berita & katalis', icon: Newspaper },
]

function Tag({ children, tone = '' }: { children: React.ReactNode; tone?: string }) { return <span className={`tag ${tone}`}>{children}</span> }
function SectionTitle({ eyebrow, title, aside }: { eyebrow?: string; title: string; aside?: React.ReactNode }) {
  return <div className="section-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{aside}</div>
}
function SourceNote({ children }: { children: React.ReactNode }) { return <div className="source-note"><Info size={12} /><span>{children}</span></div> }
function Empty({ title, children }: { title: string; children?: React.ReactNode }) { return <div className="empty-state"><Radio size={28} /><h3>{title}</h3><p>{children}</p></div> }

function PriceChart({ data }: { data: Dashboard }) {
  const [range, setRange] = useState('24J')
  const [showLevels, setShowLevels] = useState(false)
  const ranges: Record<string, number> = { '24J': 24, '7H': 7 * 24, '30H': 30 * 24, '90H': 90 * 24 }
  const useDaily = range === '90H' || (range === '30H' && data.charts.hourly.length < 700)
  const series = (useDaily ? data.charts.daily : data.charts.hourly).slice(-(useDaily ? ranges[range] / 24 + 1 : ranges[range] + 1))
  const min = Math.min(...series.map(x => x.price), ...(showLevels ? [data.analysis.levels.support[0]] : []))
  const max = Math.max(...series.map(x => x.price), ...(showLevels ? [data.analysis.levels.resistance[0]] : []))
  const pad = Math.max((max - min) * 0.15, max * 0.001)
  const change = range === '24J' ? data.market.change24h : (series.at(-1)!.price / series[0].price - 1) * 100
  return <section className="panel chart-panel">
    <div className="panel-heading"><div className="title-with-icon"><span className="bitcoin-small">₿</span><div><h2>Pergerakan harga</h2><span className="muted small">Bitcoin <span className="dot-separator">/</span> {data.market.quote}</span></div></div><div className="chart-legend"><i /> Harga penutupan</div></div>
    <div className="chart-controls"><div className="chart-price">{money(data.market.price, 2)} <span className={change >= 0 ? 'positive' : 'negative'}>{change >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}{percent(change)}<small> {range === '24J' ? '24 jam' : `${ranges[range] / 24} hari`}</small></span></div><div className="segmented" aria-label="Periode grafik">{Object.keys(ranges).map(r => <button key={r} aria-pressed={r === range} onClick={() => setRange(r)}>{r}</button>)}</div></div>
    <div className="price-chart" role="img" aria-label={`Grafik harga Bitcoin ${range}; ${series.length} titik penutupan, perubahan ${percent(change)}`}>
      <ResponsiveContainer width="100%" height="100%"><AreaChart data={series} margin={{ left: 0, right: 4, top: 15, bottom: 5 }} accessibilityLayer>
        <defs><linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59649" stopOpacity={0.24} /><stop offset="95%" stopColor="#f59649" stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="#282a2e" strokeDasharray="3 5" />
        <XAxis dataKey="time" minTickGap={55} tickLine={false} axisLine={false} tick={{ fill: '#797c85', fontSize: 11 }} tickMargin={13} tickFormatter={t => range === '24J' ? clock(t) : date(t, true)} />
        <YAxis orientation="right" domain={[min - pad, max + pad]} tickCount={5} axisLine={false} tickLine={false} width={65} tick={{ fill: '#797c85', fontSize: 11 }} tickFormatter={n => number(n)} />
        <Tooltip content={({ active, payload }) => active && payload?.length ? <div className="chart-tooltip"><span>{date(payload[0].payload.time, true)} · {clock(payload[0].payload.time)} WIB</span><strong>{money(Number(payload[0].value), 2)}</strong><small>Volume candle {number(payload[0].payload.volume, 2)} BTC</small></div> : null} />
        {showLevels && <><ReferenceLine y={data.analysis.levels.support[0]} stroke="#5bc69e" strokeDasharray="4 4" label={{ value: 'S1', fill: '#5bc69e', fontSize: 11, position: 'insideTopLeft' }} /><ReferenceLine y={data.analysis.levels.resistance[0]} stroke="#e77983" strokeDasharray="4 4" label={{ value: 'R1', fill: '#e77983', fontSize: 11, position: 'insideTopLeft' }} /></>}
        <Area type="linear" dataKey="price" stroke="#f59649" strokeWidth={2} fill="url(#price-fill)" isAnimationActive={false} activeDot={{ r: 5, stroke: '#131416', strokeWidth: 3, fill: '#ffaf6c' }} />
      </AreaChart></ResponsiveContainer>
    </div>
    <div className="chart-bottom"><div><span className="muted">Terendah 24j</span><strong>{money(data.market.low24h)}</strong><span className="range-track"><i /></span><span className="muted">Tertinggi</span><strong>{money(data.market.high24h)}</strong></div><button className={`quiet-button ${showLevels ? 'selected' : ''}`} onClick={() => setShowLevels(!showLevels)} aria-pressed={showLevels}><Layers3 size={14} /> Level S/R</button></div>
    <div className="chart-source">{data.market.source} · {data.market.quote === 'USDT' ? 'Pasangan BTC/USDT; USDT dapat berbeda dari USD' : `Pasangan BTC/${data.market.quote}`} · Waktu WIB</div>
  </section>
}

function Probability({ data, onMethod }: { data: Dashboard; onMethod: () => void }) {
  const p = data.analysis.probability
  if (!p) return <section className="panel"><Empty title="Riwayat belum cukup">Diperlukan minimal 150 candle harian untuk memperkirakan frekuensi arah.</Empty></section>
  const up = p.up >= p.down
  return <section className="panel probability-panel">
    <div className="panel-heading"><h2>Ke mana berikutnya?</h2><button className="icon-button" aria-label="Metodologi probabilitas" onClick={onMethod}><CircleHelp size={17} /></button></div>
    <p className="muted small">Estimasi arah · penutupan harian berikutnya</p>
    <div className="gauge-wrap"><svg viewBox="0 0 240 145" aria-hidden="true"><path d="M 26 120 A 94 94 0 0 1 214 120" fill="none" stroke="#313034" strokeWidth="13" strokeLinecap="round" /><path d="M 26 120 A 94 94 0 0 1 214 120" fill="none" stroke={up ? '#69c7a4' : '#ed8188'} strokeWidth="13" strokeLinecap="round" pathLength="100" strokeDasharray={`${Math.max(p.up, p.down)} 100`} /><path d="M 45 120 A 75 75 0 0 1 195 120" fill="none" stroke="#2d2e32" strokeWidth="1" strokeDasharray="1 7" /></svg><div className="gauge-label"><span className="muted">Bias historis</span><strong>{number(Math.max(p.up, p.down), 0)}<small>%</small></strong><span className={up ? 'positive' : 'negative'}>{up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{up ? 'Cenderung naik' : 'Cenderung turun'}</span></div></div>
    <div className="probability-split"><div><span><i className="green-dot" /> Naik</span><strong className="positive">{number(p.up, 0)}%</strong></div><span className="split-divider" /><div><span><i className="red-dot" /> Turun</span><strong className="negative">{number(p.down, 0)}%</strong></div></div>
    <div className="probability-note"><Sparkles size={15} /><span>Berdasarkan <strong>{p.samples} pola serupa</strong> dari {p.historyDays} hari historis.</span></div>
    <div className="probability-foot"><span>Rentang 95% untuk naik</span><strong>{p.interval[0]}–{p.interval[1]}%</strong></div>
    <button className="text-button full-width" onClick={onMethod}>Lihat metode & evaluasi <ArrowUpRight size={14} /></button>
  </section>
}

function Levels({ data }: { data: Dashboard }) {
  const a = data.analysis, l = a.levels
  return <section className="panel levels-panel">
    <div className="panel-heading"><div className="title-with-icon"><Target size={18} className="muted" /><h2>Level penting hari ini</h2></div><Tag>Pivot klasik</Tag></div>
    <p className="muted small">Area perhatian, bukan kepastian titik pembalikan.</p>
    <div className="level-grid">{[['Support', l.support, 'positive', 'S'], ['Resistance', l.resistance, 'negative', 'R']].map(([label, values, tone, prefix]) => <div className="level-column" key={String(label)}><span className={`level-label ${tone}`}>{label === 'Support' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{String(label)}</span>{(values as number[]).map((n, i) => <div className="level-row" key={n}><span>{String(prefix)}{i + 1}</span><strong>{money(n)}</strong><small>{percent((n / data.market.price - 1) * 100)}</small></div>)}</div>)}</div>
    <div className="pivot-row"><span><span className="pivot-dot" /> Pivot harian</span><strong>{money(l.pivot)}</strong><span className="muted">{data.market.quote}</span></div>
    <SourceNote>Candle {l.sourceDay} UTC · Diperbarui pukul 07.00 WIB</SourceNote>
  </section>
}

function Flow({ data, detailed = false }: { data: Dashboard; detailed?: boolean }) {
  const flow = data.market.flow
  if (!flow) return <section className="panel"><div className="panel-heading"><h2>Di sisi mana pasar?</h2><Activity size={18} className="muted" /></div><Empty title="Data arus transaksi tidak tersedia">Sumber {data.market.source} belum menyediakan data taker pada integrasi ini. Angka beli/jual tidak diestimasi.</Empty></section>
  const buy = flow.buyVolume / (flow.buyVolume + flow.sellVolume) * 100
  return <section className="panel flow-panel">
    <div className="panel-heading"><div className="title-with-icon"><Activity size={18} className="muted" /><h2>Di sisi mana pasar?</h2></div><Tag tone={buy >= 50 ? 'green' : 'red'}>{buy >= 50 ? 'Beli' : 'Jual'} lebih agresif</Tag></div>
    <p className="muted small">Volume taker · 24 candle per jam terakhir</p>
    <div className="flow-numbers"><div><span className="positive"><ArrowDownLeft size={15} /> Beli agresif</span><strong>{number(buy, 1)}<small>%</small></strong></div><div><span className="negative">Jual agresif <ArrowUpRight size={15} /></span><strong>{number(100 - buy, 1)}<small>%</small></strong></div></div>
    <div className="flow-bar" aria-label={`Volume beli ${number(buy, 1)} persen, jual ${number(100 - buy, 1)} persen`}><div style={{ width: `${buy}%` }} /><div style={{ width: `${100 - buy}%` }} /></div>
    <div className="flow-volumes"><span>{number(flow.buyVolume, 2)} BTC</span><span>{number(flow.sellVolume, 2)} BTC</span></div>
    <div className="flow-transactions"><div><span className="muted">Agregat transaksi beli</span><strong>{flow.buyTrades == null ? '—' : number(flow.buyTrades)} <ArrowDownLeft size={13} className="positive" /></strong></div><div><span className="muted">Agregat transaksi jual</span><strong>{flow.sellTrades == null ? '—' : number(flow.sellTrades)} <ArrowUpRight size={13} className="negative" /></strong></div></div>
    <SourceNote>{flow.samples ? `${number(flow.samples)} agregat transaksi terakhir; bukan jumlah orang unik.` : 'Hitungan agregat transaksi tidak tersedia.'}</SourceNote>
    {detailed && <div className="flow-detail"><p>Setiap transaksi memiliki pembeli dan penjual. Label di atas menunjukkan pihak yang mengambil likuiditas (taker), sehingga tidak mengukur jumlah seluruh pemegang Bitcoin.</p><dl><dt>Rentang volume</dt><dd>{date(flow.from, true)} {clock(flow.from)}–{date(flow.to, true)} {clock(flow.to)} WIB</dd><dt>Sampel agregat transaksi</dt><dd>{flow.sampleFrom && flow.sampleTo ? `${clock(flow.sampleFrom)}–${clock(flow.sampleTo)} WIB` : 'Tidak tersedia'}</dd><dt>Cakupan</dt><dd>{flow.source}, satu bursa</dd></dl></div>}
  </section>
}

function DailyBrief({ data, expanded = false, onExpand }: { data: Dashboard; expanded?: boolean; onExpand: () => void }) {
  const a = data.analysis
  return <section className="panel daily-panel"><div className="daily-icon"><Sparkles size={21} /></div><div className="daily-content"><div className="daily-heading"><span className="eyebrow">CATATAN PASAR HARIAN</span><Tag tone={a.trend === 'bullish' ? 'green' : a.trend === 'bearish' ? 'red' : ''}>{a.trend === 'bullish' ? 'Bullish' : a.trend === 'bearish' ? 'Bearish' : 'Netral'}</Tag><span className="muted small">{date(`${a.day}T00:00:00Z`, true)}</span></div><h2>{a.summary}</h2><p>{a.explanation}</p>{expanded && <div className="analysis-meta"><Clock3 size={13} /> Menggunakan data sampai {date(a.asOf, true)}, {clock(a.asOf)} WIB. Berlaku sampai {date(a.validUntil, true)}, {clock(a.validUntil)} WIB.</div>}</div>{!expanded && <button className="icon-button bordered" aria-label="Buka analisis harian lengkap" onClick={onExpand}><ArrowUpRight size={19} /></button>}</section>
}

function Indicators({ data }: { data: Dashboard }) {
  const i = data.analysis.indicators
  return <section className="panel"><div className="panel-heading"><h2>Di balik analisis</h2><Tag>Candle harian</Tag></div><div className="indicator-grid">{[
    { name: 'RSI (14)', value: number(i.rsi, 1), label: i.rsi >= 70 ? 'Jenuh beli' : i.rsi <= 30 ? 'Jenuh jual' : 'Rentang normal', detail: 'Momentum 0–100' },
    { name: 'SMA (20)', value: money(i.sma20), label: 'Tren jangka pendek', detail: 'Rata-rata 20 hari' },
    { name: 'SMA (50)', value: money(i.sma50), label: 'Tren menengah', detail: 'Rata-rata 50 hari' },
    { name: 'MACD (12, 26)', value: number(i.macd, 2), label: i.macd >= 0 ? 'Momentum positif' : 'Momentum negatif', detail: 'Selisih EMA 12 dan 26' },
    { name: 'ATR (14)', value: money(i.atr), label: `${number(i.atrPercent, 2)}% dari penutupan`, detail: 'Rentang aktual rata-rata' },
    { name: 'EMA (20)', value: money(i.ema20), label: 'Bobot data terbaru', detail: 'Rata-rata eksponensial' },
  ].map(item => <div className="indicator" key={item.name}><span>{item.name}<span className="muted">{item.detail}</span></span><strong>{item.value}</strong><small>{item.label}</small></div>)}</div></section>
}

function Scenarios({ data }: { data: Dashboard }) {
  return <><SectionTitle eyebrow="RENCANA BERSYARAT" title="Dua arah. Tetap punya konteks." /><div className="two-column scenario-grid">{data.analysis.scenarios.map(s => <section className={`panel scenario ${s.direction}`} key={s.direction}><span className={`scenario-icon ${s.direction === 'up' ? 'positive' : 'negative'}`}>{s.direction === 'up' ? <TrendingUp size={22} /> : <TrendingDown size={22} />}</span><h3>{s.title}</h3><p>{s.description}</p><div className="scenario-targets"><div><span>Pemicu</span><strong>{money(s.trigger)}</strong></div><ArrowRight size={17} /><div><span>Area berikutnya</span><strong>{money(s.target)}</strong></div><div><span>Invalidasi</span><strong>{money(s.invalidation)}</strong></div></div></section>)}</div></>
}

function News({ data, full = false, onAll }: { data: Dashboard; full?: boolean; onAll: () => void }) {
  const [category, setCategory] = useState('Semua')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<NewsItem | null>(null)
  const all = data.news.articles.filter(n => (category === 'Semua' || n.category === category) && `${n.title} ${n.summary}`.toLowerCase().includes(query.toLowerCase()))
  const list = full ? all : all.slice(0, 3)
  const categories = ['Semua', 'Pasar', 'Institusi', 'Makro', 'Regulasi']
  return <section className="news-section"><SectionTitle eyebrow="DI LUAR GRAFIK" title="Berita yang perlu kamu tahu" aside={!full && <button className="text-button" onClick={onAll}>Semua berita <ArrowRight size={15} /></button>} />
    {full && <div className="news-toolbar"><div className="filter-tabs">{categories.map(c => <button key={c} onClick={() => setCategory(c)} aria-pressed={category === c}>{c}</button>)}</div><label className="search-input"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari berita Bitcoin..." aria-label="Cari berita Bitcoin" /></label></div>}
    {data.news.errors.length > 0 && <div className="inline-notice"><Info size={14} /> {data.news.errors.join(', ')} belum dapat diperbarui. {data.news.articles.length ? `Menampilkan arsip dari ${date(data.news.fetchedAt, true)} ${clock(data.news.fetchedAt)} WIB.` : 'Berita akan muncul setelah sumber RSS dapat diakses.'}</div>}
    {data.meta.newsStale && !data.news.errors.length && <div className="inline-notice"><Clock3 size={14} /> Snapshot berita lebih dari 15 menit. Diperbarui terakhir {date(data.news.fetchedAt, true)} {clock(data.news.fetchedAt)} WIB; menunggu pembaruan berikutnya.</div>}
    {!list.length ? <div className="panel"><Empty title={data.news.articles.length ? 'Tidak ada berita yang cocok' : 'Menunggu berita dari sumber'}>{data.news.articles.length ? 'Coba kata kunci atau kategori lain.' : 'Artikel ditampilkan sesuai judul dan bahasa asli penerbit, lengkap dengan tautan sumber.'}</Empty></div> : <div className="news-grid">{list.map((article, index) => <button className="news-card" key={article.id} onClick={() => setSelected(article)}><div className={`news-art art-${['institution', 'macro', 'market'][index % 3]}`}><div className="art-grid" />{article.category === 'Institusi' ? <LandmarkArt /> : article.category === 'Makro' ? <Globe2 size={74} strokeWidth={0.7} /> : <BitcoinArt />}<span className="art-category">{article.category}</span><span className="art-arrow"><ArrowUpRight size={16} /></span></div><div className="news-card-body"><div className="news-meta"><span className="publisher-dot" />{article.source}<span>·</span><span>{age(article.publishedAt)}</span></div><h3>{article.title}</h3><span className="read-link">{article.demo ? 'Lihat contoh' : 'Baca ringkasan'} <ArrowUpRight size={13} /></span></div></button>)}</div>}
    <SourceNote>{data.mode === 'demo' ? 'Contoh topik untuk demonstrasi antarmuka. Bukan berita terkini.' : `RSS CoinDesk & Cointelegraph · Diperbarui ${clock(data.news.fetchedAt)} WIB${isGitHubPages ? " · Snapshot GitHub Actions" : ""} · Kategori otomatis dari kata kunci`}</SourceNote>
    {selected && <Modal title={selected.demo ? 'Contoh materi — mode simulasi' : selected.source} onClose={() => setSelected(null)}><Tag>{selected.category}</Tag><h2 className="article-title">{selected.title}</h2><p className="muted">{date(selected.publishedAt)} · {clock(selected.publishedAt)} WIB</p><p className="article-summary">{selected.summary || 'Ringkasan tidak disediakan oleh penerbit. Buka artikel asli untuk membaca selengkapnya.'}</p>{selected.url ? <a className="primary-button" href={selected.url} target="_blank" rel="noopener noreferrer">Baca di {selected.source} <ExternalLink size={15} /></a> : <div className="inline-notice"><Info size={16} /> Materi simulasi ini tidak mengacu pada peristiwa nyata.</div>}</Modal>}
  </section>
}
function BitcoinArt() { return <span className="art-bitcoin">₿</span> }
function LandmarkArt() { return <svg width="90" height="80" viewBox="0 0 90 80" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M 10 28 L 45 10 L 80 28 Z M 10 66 H 80 M 7 72 H 83 M 17 60 V 34 M 31 60 V 34 M 45 60 V 34 M 59 60 V 34 M 73 60 V 34" /></svg> }

function Moves({ data }: { data: Dashboard }) {
  const [expanded, setExpanded] = useState<number | null>(0)
  return <section><SectionTitle eyebrow="HARGA & KONTEKS" title="Apa yang menggerakkan pasar?" aside={<Tag><Zap size={12} /> Gerakan ≥1% / jam</Tag>} /><div className="panel moves-panel">{!data.moves.length ? <Empty title="Belum ada pergerakan besar">Tidak ditemukan candle tertutup dengan perubahan setidaknya 1% dalam satu jam selama 72 jam terakhir.</Empty> : data.moves.map((move, index) => <div className="move-item" key={move.time}><button className="move-trigger" onClick={() => setExpanded(expanded === index ? null : index)} aria-expanded={expanded === index}><span className={`move-icon ${move.change >= 0 ? 'positive' : 'negative'}`}>{move.change >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}</span><span className="move-title"><strong>Bitcoin {move.change >= 0 ? 'menguat' : 'terkoreksi'} {number(Math.abs(move.change), 2)}% dalam 1 jam</strong><small>{date(move.time, true)} · {clock(move.time)} WIB <span>·</span> {money(move.from)} → {money(move.to)}</small></span><Tag tone={move.change >= 0 ? 'green' : 'red'}>{percent(move.change)}</Tag><ChevronDown size={17} className={expanded === index ? 'rotated' : ''} /></button>{expanded === index && <div className="move-details"><div><span className="detail-label"><span className="green-dot" />Yang teramati</span><p>{move.observation}</p></div><div><span className="detail-label"><span className="orange-dot" />Kemungkinan penjelasan</span><p>{move.hypothesis}</p></div><div><span className="detail-label"><span className="neutral-dot" />Yang perlu dipantau</span><p>{move.outlook}</p></div>{move.related.length > 0 && <div className="related-news"><span>Artikel dalam jendela ±6 jam — kedekatan waktu tidak membuktikan sebab akibat:</span>{move.related.map(n => <a key={n.url} href={n.url} target="_blank" rel="noopener noreferrer">{n.title}<ExternalLink size={12} /></a>)}</div>}</div>}</div>)}<SourceNote>Cakupan {data.market.source}. Penyebab pasti membutuhkan konfirmasi tambahan di luar data harga dan volume.</SourceNote></div></section>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const element = ref.current; element?.showModal(); const original = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = original; element?.close() } }, [])
  return <dialog ref={ref} className="modal" onCancel={onClose} onClick={e => { if (e.target === ref.current) onClose() }} aria-label={title}><div className="modal-inner"><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Tutup dialog"><X size={20} /></button></div>{children}</div></dialog>
}

function Methodology({ data, onClose }: { data: Dashboard | null; onClose: () => void }) {
  const p = data?.analysis.probability
  return <Modal title="Transparansi, sebelum prediksi." onClose={onClose}><p className="modal-intro">Setiap angka punya sumber. Setiap proyeksi punya batas.</p><div className="method-sections"><section><span className="method-number">01</span><div><h3>Harga dan aktivitas pasar</h3><p>Harga diambil dari Binance Spot BTC/USDT, dengan Coinbase BTC/USD sebagai cadangan. USDT adalah stablecoin; nilainya dapat berbeda dari USD. Pembaruan setiap 60 detik {isGitHubPages ? 'selama halaman terbuka' : 'selama server berjalan'}. Data lebih dari 90 detik ditandai kedaluwarsa.</p><p>Volume beli/jual menunjukkan taker, yaitu pihak yang mengambil likuiditas. Sampel agregat transaksi bukan jumlah orang unik dan hanya mewakili satu bursa.</p></div></section><section><span className="method-number">02</span><div><h3>Level dan analisis harian</h3><p>Analisis diperbarui setelah candle harian UTC selesai, pukul 07.00 WIB. Pivot P = (high + low + close) / 3; S1 = 2P − high; R1 = 2P − low; S2 = P − (high − low); R2 = P + (high − low). Level tidak menjamin adanya order atau pembalikan.</p><p>Indikator: RSI Wilder 14, ATR Wilder 14, SMA 20/50, EMA 20, serta MACD berupa selisih EMA 12 dan 26. Skenario adalah kondisi untuk dipantau, bukan instruksi membeli atau menjual.</p></div></section><section><span className="method-number">03</span><div><h3>Probabilitas dari pola historis</h3><p>Model memilih 50 hari terdekat berdasarkan jarak Euclidean: RSI/25, deviasi SMA20 ×20, return 7 hari ×10, dan ATR/harga ×20. Frekuensi naik di hari berikutnya menjadi estimasi. Hari tanpa perubahan dikecualikan. Horizon adalah penutupan hari UTC berikutnya dibanding penutupan terakhir, bukan harga saat ini.</p><p>Evaluasi walk-forward menggunakan data yang telah diketahui pada waktu prediksi, tanpa melihat hasil masa depan. Pola dapat saling berkorelasi; interval Wilson 95% hanya menggambarkan ketidakpastian sampel, bukan jaminan akurasi prediksi atau probabilitas yang terkalibrasi.</p>{p?.backtest && <div className="evaluation-grid"><div><span>Akurasi model</span><strong>{p.backtest.accuracy}%</strong></div><div><span>Baseline mayoritas</span><strong>{p.backtest.baselineAccuracy}%</strong></div><div><span>Brier score</span><strong>{p.backtest.brier}</strong></div><div><span>Hari evaluasi</span><strong>{p.backtest.days}</strong></div></div>}<p className="muted small">{data?.mode === 'demo' ? 'Evaluasi di atas menggunakan data simulasi.' : 'Akurasi historis tidak menjamin kinerja berikutnya.'} Brier lebih rendah lebih baik (0–1). Baseline selalu memilih kelas mayoritas dari riwayat yang telah tersedia.</p></div></section><section><span className="method-number">04</span><div><h3>Berita dan interpretasi</h3><p>Berita berasal dari RSS CoinDesk dan Cointelegraph. {isGitHubPages ? 'Snapshot diperbarui melalui GitHub Actions dengan jadwal 10 menit; eksekusi dapat tertunda.' : 'Diperbarui setiap 10 menit.'} Judul mengikuti bahasa asli. Artikel terkait gerakan harga dipilih berdasarkan jendela ±6 jam; ini hanya korelasi waktu. Penjelasan berbasis aturan ditandai sebagai hipotesis, bukan penyebab terkonfirmasi.</p></div></section></div><div className="method-footer"><ShieldCheck size={18} /><p>Dashboard riset untuk membantu memahami pasar. Tidak ada prediksi yang pasti atau jaminan keuntungan.</p></div></Modal>
}

function Archive({ onClose, mode }: { onClose: () => void; mode: Mode }) {
  const [reports, setReports] = useState<(DailyAnalysis & { source: string; quote: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => { const controller = new AbortController(); loadArchive(controller.signal).then(d => setReports(d.reports)).catch(e => { if (e.name !== 'AbortError') setError(true) }).finally(() => setLoading(false)); return () => controller.abort() }, [])
  return <Modal title="Arsip analisis harian" onClose={onClose}>{mode === 'demo' && <div className="inline-notice"><Info size={15} /> Arsip hanya menyimpan laporan dari data live, bukan simulasi.</div>}{loading ? <p className="muted">Memuat arsip...</p> : error ? <Empty title="Arsip belum dapat dimuat">Periksa server dan coba lagi.</Empty> : !reports.length ? <Empty title="Arsip dimulai dari hari pertama">Laporan tersimpan otomatis setelah data live berhasil diperoleh. Maksimal 30 laporan terbaru ditampilkan.</Empty> : reports.map(r => <div className="archive-item" key={`${r.day}-${r.quote}`}><div><strong>{date(`${r.day}T00:00:00Z`)}</strong><Tag tone={r.trend === 'bullish' ? 'green' : r.trend === 'bearish' ? 'red' : ''}>{r.trend}</Tag></div><p>{r.summary}</p><small>{r.source} · S1 {money(r.levels.support[0])} · R1 {money(r.levels.resistance[0])} · Naik {r.probability?.up ?? '—'}%</small></div>)}</Modal>
}

export default function App() {
  const initialView = location.hash.slice(1)
  const [view, setView] = useState<View>(views.some(v => v.id === initialView) ? initialView as View : 'overview')
  const [mode, setMode] = useState<Mode>(new URLSearchParams(location.search).get('demo') === '1' ? 'demo' : 'live')
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [method, setMethod] = useState(false)
  const [archive, setArchive] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(Date.now())
  const controllerRef = useRef<AbortController | null>(null)
  const requestId = useRef(0)
  const refresh = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController(); controllerRef.current = controller
    const id = ++requestId.current
    setLoading(true)
    try {
      const result = await loadDashboard(mode, controller.signal)
      if (id !== requestId.current) return
      setData(result); setError(null)
    } catch (e) {
      if ((e as Error).name !== 'AbortError' && id === requestId.current) setError((e as Error).message === 'Failed to fetch' ? 'Server belum dapat dihubungi. Coba lagi beberapa saat.' : (e as Error).message)
    } finally { if (id === requestId.current) setLoading(false) }
  }, [mode])
  useEffect(() => { setData(null); setError(null); void refresh(); const timer = setInterval(() => { if (!document.hidden) void refresh() }, 60000); const visible = () => { if (!document.hidden) void refresh() }; document.addEventListener('visibilitychange', visible); return () => { controllerRef.current?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visible) } }, [refresh])
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => { const change = () => { const next = location.hash.slice(1); if (views.some(v => v.id === next)) setView(next as View) }; window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change) }, [])
  const navigate = (next: View) => { setView(next); location.hash = next; setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'instant' }) }
  const switchMode = (next: Mode) => { setData(null); setError(null); setMode(next); const url = new URL(location.href); if (next === 'demo') url.searchParams.set('demo', '1'); else url.searchParams.delete('demo'); history.replaceState(null, '', url) }
  const stale = data && (data.meta.stale || Boolean(error) || (data.mode === 'live' && now - Date.parse(data.meta.fetchedAt) > 90000))
  const downloadReport = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify({ mode: data.mode, source: data.market.source, quote: data.market.quote, exportedAt: new Date().toISOString(), analysis: data.analysis }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `satoshi-${data.mode}-${data.analysis.day}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const copySummary = async () => {
    if (!data) return
    try { await navigator.clipboard.writeText(`${data.mode === 'demo' ? '[SIMULASI] ' : ''}Satoshi · ${data.analysis.day}\n${data.analysis.summary}\nS1 ${money(data.analysis.levels.support[0])} | R1 ${money(data.analysis.levels.resistance[0])} (${data.market.quote})\nSumber: ${data.market.source}. Estimasi historis, bukan kepastian.`); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { downloadReport() }
  }
  const title = view === 'overview' ? <>Bitcoin, <span>dipahami.</span></> : view === 'analysis' ? <>Baca pola. <span>Pahami peluang.</span></> : view === 'activity' ? <>Ikuti arus. <span>Temukan konteks.</span></> : <>Berita hari ini. <span>Perspektif esok.</span></>
  return <div className="app-shell">
    {mobileMenu && <button className="sidebar-overlay" onClick={() => setMobileMenu(false)} aria-label="Tutup navigasi" />}
    <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}><a className="brand" href="#overview" onClick={e => { e.preventDefault(); navigate('overview') }}><span className="brand-symbol">₿</span><div><strong>satoshi<span>.</span></strong><small>BITCOIN INTELLIGENCE</small></div></a><div className="sidebar-label">WORKSPACE</div><nav aria-label="Navigasi utama">{views.map(v => <button key={v.id} className={`nav-item ${view === v.id ? 'active' : ''}`} onClick={() => navigate(v.id)} aria-current={view === v.id ? 'page' : undefined}><v.icon size={18} /><span>{v.name}</span>{view === v.id && <span className="nav-active-dot" />}{v.id === 'news' && data && data.news.articles.length > 0 && <span className="nav-count">{data.news.articles.length}</span>}</button>)}</nav><div className="sidebar-rule" /><button className="nav-item" onClick={() => { setMethod(true); setMobileMenu(false) }}><BookOpen size={18} /><span>Metodologi</span><ArrowUpRight size={13} /></button><div className="sidebar-bottom"><div className="sidebar-note"><span className="sidebar-note-icon"><Zap size={17} /></span><h3>Lebih dari sekadar harga.</h3><p>Data, konteks, dan perspektif untuk setiap pergerakan.</p><button onClick={() => setMethod(true)}>Kenali cara kerjanya <ArrowUpRight size={13} /></button></div><div className="sidebar-status"><i className={data && mode === 'live' && !stale && !error ? 'green-dot' : 'orange-dot'} /><div><strong>{mode === 'demo' ? 'Mode simulasi' : data && !stale && !error ? 'Data terhubung' : 'Menunggu sumber'}</strong><span>BTC intelligence workspace</span></div><Globe2 size={15} /></div></div></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Buka navigasi"><Menu size={21} /></button><span>Workspace</span><ChevronRight size={13} /><strong>{views.find(v => v.id === view)?.name}</strong></div><div className="topbar-right"><span className="timezone"><Globe2 size={13} /> WIB · UTC+7</span><span className="topbar-divider" /><button className="quiet-button" onClick={() => setMethod(true)}><CircleHelp size={16} /><span>Panduan</span></button><span className="avatar">S</span></div></header>
    <main id="main-content"><div className="page-heading"><div><div className="page-eyebrow"><span className="orange-dot" /> THE BITCOIN PERSPECTIVE</div><h1>{title}</h1><p>Satu tempat untuk melihat harga, membaca sinyal, dan memahami pasar.</p></div><div className="heading-actions"><span className="today"><Clock3 size={13} />{date(now, true)}</span><button className="secondary-button refresh-button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} />{loading ? 'Memperbarui' : 'Perbarui'}</button></div></div>
    {mode === 'demo' && <div className="demo-banner" role="status"><span className="demo-banner-icon"><Sparkles size={17} /></span><div><strong>Mode demo — data simulasi</strong><span>Angka, grafik, berita, dan analisis berikut bukan kondisi pasar terkini.</span></div><button onClick={() => switchMode('live')}>Gunakan data live <ArrowUpRight size={14} /></button></div>}
    {(stale || (error && data)) && <div className="warning-banner" role="alert"><WifiOff size={17} /><span>Data belum berhasil diperbarui. Menampilkan rekaman {data ? `${date(data.meta.fetchedAt, true)} ${clock(data.meta.fetchedAt)} WIB` : ''}; jangan dianggap sebagai harga terkini.</span></div>}
    {data?.meta.analysisStale && <div className="warning-banner" role="alert"><Clock3 size={16} /> Analisis harian kedaluwarsa. Menunggu candle terbaru; level dan probabilitas masih berasal dari {data.analysis.day}.</div>}
    {!data ? <div className="connection-panel panel">{loading ? <><div className="loading-bitcoin">₿</div><h2>Menyambungkan perspektif pasar...</h2><p>Mengambil harga, candle harian, dan berita dari sumber publik.</p><div className="loading-bars"><i /><i /><i /></div></> : <><span className="connection-icon"><WifiOff size={29} /></span><Tag tone="amber">Sumber belum terhubung</Tag><h2>Dashboard siap. Menunggu data pasar.</h2><p>{error || 'Data pasar belum tersedia.'}</p><div className="connection-actions"><button className="primary-button" onClick={() => void refresh()}><RefreshCw size={15} /> Coba sambungkan lagi</button><button className="secondary-button" onClick={() => switchMode('demo')}><Sparkles size={15} /> Jelajahi demo</button></div><div className="connection-features"><span><BarChart3 size={18} />Grafik interaktif</span><span><Target size={18} />Analisis harian</span><span><Newspaper size={18} />Berita & konteks</span></div><SourceNote>Data live membutuhkan akses HTTPS ke API Binance / Coinbase dan RSS CoinDesk / Cointelegraph. Mode demo menggunakan data sintetis berlabel.</SourceNote></>}</div> : <>
    <div className="data-status"><div><Tag tone={mode === 'demo' ? 'amber' : stale ? 'red' : 'green'}><span className={mode === 'demo' ? 'orange-dot' : stale ? 'red-dot' : 'green-dot'} />{mode === 'demo' ? 'SIMULASI' : stale ? 'DATA TERTUNDA' : 'LIVE'}</Tag><span>{data.market.source}<span className="dot-separator">·</span>BTC / {data.market.quote}</span></div><span><span className="desktop-only">Diperbarui </span>{clock(data.meta.fetchedAt)} WIB <span className="dot-separator">·</span> Interval 60 detik</span></div>
    {view === 'overview' && <><div className="stats-grid"><div className="stat-card"><div className="stat-label">Harga Bitcoin<span className="stat-icon orange"><span>₿</span></span></div><strong>{money(data.market.price, 2)}</strong><div className="stat-foot"><Tag tone={data.market.change24h >= 0 ? 'green' : 'red'}>{data.market.change24h >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{percent(data.market.change24h)}</Tag><span>dalam 24 jam</span></div></div><div className="stat-card"><div className="stat-label">Volume perdagangan 24j<BarChart3 size={16} /></div><strong>${compact(data.market.quoteVolume24h)}</strong><div className="stat-foot"><span>{number(data.market.volume24h, 0)} BTC diperdagangkan</span></div>{data.market.quoteVolumeEstimated && <span className="tiny muted">Estimasi volume × harga terkini</span>}</div><div className="stat-card"><div className="stat-label">Momentum harian<Activity size={16} /></div><strong>{number(data.analysis.indicators.rsi, 1)}<small> / 100</small></strong><div className="stat-foot"><span className={data.analysis.indicators.rsi > 70 || data.analysis.indicators.rsi < 30 ? 'orange-text' : 'positive'}><span className="green-dot" />{data.analysis.indicators.rsi > 70 ? 'Jenuh beli' : data.analysis.indicators.rsi < 30 ? 'Jenuh jual' : 'Rentang normal'}</span><span>RSI (14)</span></div></div><div className="stat-card"><div className="stat-label">Volatilitas harian<Zap size={16} /></div><strong>{number(data.analysis.indicators.atrPercent, 2)}<small>%</small></strong><div className="stat-foot"><span>ATR (14)</span><span>± {money(data.analysis.indicators.atr)}</span></div></div></div><div className="chart-grid"><PriceChart data={data} /><Probability data={data} onMethod={() => setMethod(true)} /></div><DailyBrief data={data} onExpand={() => navigate('analysis')} /><div className="two-column"><Levels data={data} /><Flow data={data} /></div><News data={data} onAll={() => navigate('news')} /><Moves data={data} /></>}
    {view === 'analysis' && <><div className="analysis-toolbar"><Tag><Clock3 size={12} /> Diperbarui harian · 07.00 WIB</Tag><div><button className="quiet-button" onClick={() => setArchive(true)}><Clock3 size={15} />Arsip</button><button className="secondary-button" onClick={() => void copySummary()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Tersalin' : 'Salin ringkasan'}</button><button className="secondary-button" onClick={downloadReport}><Download size={14} />Ekspor JSON</button></div></div><DailyBrief data={data} expanded onExpand={() => {}} /><div className="chart-grid"><div className="analysis-left"><Levels data={data} /><Indicators data={data} /></div><Probability data={data} onMethod={() => setMethod(true)} /></div><Scenarios data={data} /><Moves data={data} /></>}
    {view === 'activity' && <><div className="two-column"><Flow data={data} detailed /><section className="panel activity-context"><span className="context-icon"><Activity size={25} /></span><h2>Transaksi, bukan jumlah orang.</h2><p>Setiap jual selalu berpasangan dengan beli. Yang membedakan adalah siapa yang lebih agresif mengambil harga yang tersedia.</p><div className="context-definition"><span className="positive"><ArrowDownLeft size={17} /> Beli agresif</span><p>Pembeli mengambil likuiditas dari penjual. Pada Binance, flag buyer maker bernilai false.</p></div><div className="context-definition"><span className="negative"><ArrowUpRight size={17} /> Jual agresif</span><p>Penjual mengambil likuiditas dari pembeli. Pada Binance, flag buyer maker bernilai true.</p></div><SourceNote>Satu orang dapat membuat banyak transaksi. Data ini tidak mewakili seluruh pasar Bitcoin.</SourceNote></section></div><PriceChart data={data} /><Moves data={data} /></>}
    {view === 'news' && <><News data={data} full onAll={() => {}} /><Moves data={data} /></>}
    </>}
    <footer className="footer"><span><span className="footer-brand">satoshi.</span> Data untuk berpikir lebih jernih.</span><div><span>Riset, bukan kepastian.</span><button onClick={() => setMethod(true)}>Sumber & metodologi <ArrowUpRight size={12} /></button></div></footer>
    </main></div>{method && <Methodology data={data} onClose={() => setMethod(false)} />}{archive && <Archive mode={mode} onClose={() => setArchive(false)} />}
  </div>
}
