#!/usr/bin/env python3
"""Lista todas as aulas que precisam de traducao PT-BR."""
import os
import json

BASE = "/tmp/ai-engineering-from-scratch/phases"

def find_lessons():
    """Encontra todas as aulas que tem en.md mas nao tem pt-br.md."""
    to_translate = []
    already_done = []
    
    for phase_dir in sorted(os.listdir(BASE)):
        phase_path = os.path.join(BASE, phase_dir)
        if not os.path.isdir(phase_path):
            continue
        
        for lesson_dir in sorted(os.listdir(phase_path)):
            lesson_path = os.path.join(phase_path, lesson_dir)
            docs_path = os.path.join(lesson_path, "docs")
            
            if not os.path.isdir(docs_path):
                continue
            
            en_md = os.path.join(docs_path, "en.md")
            pt_br_md = os.path.join(docs_path, "pt-br.md")
            
            if os.path.exists(en_md):
                if os.path.exists(pt_br_md):
                    already_done.append(f"{phase_dir}/{lesson_dir}")
                else:
                    to_translate.append({
                        "phase": phase_dir,
                        "lesson": lesson_dir,
                        "en_path": en_md,
                        "pt_br_path": pt_br_md,
                        "phase_num": int(phase_dir.split("-")[0])
                    })
    
    return to_translate, already_done

def group_by_phase(lessons):
    """Agrupa aulas por fase."""
    phases = {}
    for lesson in lessons:
        phase = lesson["phase"]
        if phase not in phases:
            phases[phase] = []
        phases[phase].append(lesson)
    return phases

if __name__ == "__main__":
    to_translate, already_done = find_lessons()
    phases = group_by_phase(to_translate)
    
    print(f"=== STATUS ===")
    print(f"Ja traduzidas: {len(already_done)}")
    print(f"Pendentes: {len(to_translate)}")
    print(f"Total: {len(to_translate) + len(already_done)}")
    print()
    
    print(f"=== POR FASE ===")
    for phase_name in sorted(phases.keys()):
        lessons = phases[phase_name]
        print(f"  {phase_name}: {len(lessons)} aulas")
    
    print()
    print(f"=== LISTA COMPLETA (JSON) ===")
    print(json.dumps(to_translate, indent=2))
