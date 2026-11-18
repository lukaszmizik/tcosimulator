import { useEffect, useRef, useState, type ReactNode } from 'react'
export function FaceplateFrame({children}: {children:ReactNode}) {
 const ref=useRef<HTMLDivElement>(null)
 const [scale,setScale]=useState(1)
 useEffect(()=>{const el=ref.current;if(!el)return;const observer=new ResizeObserver(([entry])=>setScale(entry.contentRect.width/848));observer.observe(el);return ()=>observer.disconnect()},[])
 return <div className="faceplate-frame" ref={ref} style={{height:274.08*scale}}><div style={{width:848,transform:`scale(${scale})`,transformOrigin:'top left'}}>{children}</div></div>
}
