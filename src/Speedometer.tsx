/** 0–140 km/h dial. Actual speed, not the selected target, drives the needle. */
export function Speedometer({speed}: {speed: number}) {
  const value = Math.max(0, Math.min(140, speed))
  const angle = -130 + value / 140 * 260
  const color = speed > 90 ? '#ff6268' : speed > 80 ? '#ffb350' : '#85d5ff'
  const point = (a: number, r: number) => ({x:110+Math.sin(a*Math.PI/180)*r,y:104-Math.cos(a*Math.PI/180)*r})
  return <svg className="speedometer" viewBox="0 0 220 210" role="img" aria-label={`Rychlost ${Math.round(speed)} km/h`}>
    <defs><radialGradient id="dial-face"><stop stopColor="#26343e"/><stop offset="1" stopColor="#080e13"/></radialGradient><linearGradient id="dial-rim" x2="0" y2="1"><stop stopColor="#8b969d"/><stop offset=".45" stopColor="#252c31"/><stop offset="1" stopColor="#616d76"/></linearGradient></defs>
    <circle cx="110" cy="104" r="100" fill="url(#dial-rim)"/>
    <circle cx="110" cy="104" r="96" fill="url(#dial-face)" stroke="#05090c" strokeWidth="3"/>
    {Array.from({length:29},(_,i)=>{const a=-130+i/28*260;const start=point(a,i%4===0?77:84);const end=point(a,90);return <line key={i} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={i*5>90?'#d95b62':'#d6e0e7'} strokeWidth={i%4===0?2.5:1}/>})}
    {Array.from({length:8},(_,i)=>{const pos=point(-130+i/7*260,65);return <text key={i} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fill="#d7e3eb" fontSize="12">{i*20}</text>})}
    <text x="110" y="75" textAnchor="middle" fill="#879ba9" fontSize="9" letterSpacing="2">km/h</text>
    <g className="speed-needle" style={{transform:`rotate(${angle}deg)`,transformOrigin:'110px 104px'}}><path d="M107 119 L108.5 27 L111.5 27 L113 119 Z" fill="#ff664f"/><circle cx="110" cy="104" r="9" fill="#313c45" stroke="#a7b4bd" strokeWidth="2"/></g>
    <rect x="76" y="146" width="68" height="36" rx="6" fill="#060c10" stroke="#33434f"/>
    <text x="110" y="172" textAnchor="middle" fill={color} fontSize="26" fontWeight="700">{Math.round(speed)}</text>
  </svg>
}
