#!/usr/bin/env python3
"""Extrai texto plano das obras em docs/Books.

Passo 1 de 2 da conferência das citações de `src/lib/curadoria-evidencia.ts`:

    pip install pypdf
    python3 scripts/citacoes/extrair-corpus.py      # gera .corpus-txt/
    python3 scripts/citacoes/verificar-citacoes.py  # confere cada citação

A saída vai para `.corpus-txt/` (fora do git — é derivada, e são ~1,7 MB de
texto).

NÃO extraem texto, e por isso não são fonte de citação nenhuma:
- Skinner, "Feng Shui Before & After" e Harvey, "Feng Shui Guide Book" — são
  varreduras de página (imagens), sem camada de texto; exigiriam OCR.
- Shido, "Feng Shui Professional Practice" — .mobi com PalmDOC comprimido.
- Zhao, "Zang shu / 葬書" — varredura em chinês, sem camada de texto.
- Gallagher, "The Feng-Shui Junkie" — é um ROMANCE, não obra técnica.
"""
import re, sys, zipfile, html, pathlib

RAIZ = pathlib.Path(__file__).resolve().parents[2]
SRC = RAIZ / 'docs' / 'Books'
OUT = RAIZ / '.corpus-txt'

# O `cryptography` de algumas distros tem binding Rust quebrado e estoura
# PanicException (não ImportError), o que fura o try/except do pypdf.
# Neutralizado para o pypdf cair no provider de fallback — nenhum PDF daqui
# é encriptado.
sys.modules['cryptography.hazmat.bindings._rust'] = None


def slug(nome: str) -> str:
    base = nome.split(' -- ')[0]
    return re.sub(r'[^a-z0-9]+', '-', base.lower()).strip('-')[:60]


def sem_tags(s: str) -> str:
    s = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', s)
    s = re.sub(r'(?i)</(p|div|h[1-6]|li|br|tr)\s*>', '\n', s)
    s = re.sub(r'(?i)<br\s*/?>', '\n', s)
    s = re.sub(r'(?s)<[^>]+>', ' ', s)
    s = html.unescape(s)
    s = re.sub(r'[ \t\xa0]+', ' ', s)
    return re.sub(r'\n{3,}', '\n\n', s).strip()


def de_epub(p: pathlib.Path) -> str:
    partes = []
    with zipfile.ZipFile(p) as z:
        for n in sorted(n for n in z.namelist()
                        if n.lower().endswith(('.xhtml', '.html', '.htm'))):
            partes.append(sem_tags(z.read(n).decode('utf-8', 'replace')))
    return '\n\n'.join(partes)


def de_pdf(p: pathlib.Path) -> str:
    from pypdf import PdfReader
    partes = []
    # O marcador [[p.N]] é o que permite citar página na curadoria.
    for i, pagina in enumerate(PdfReader(str(p)).pages):
        try:
            texto = pagina.extract_text() or ''
        except Exception as e:
            texto = ''
            print(f'  ! página {i + 1}: {e}', file=sys.stderr)
        partes.append(f'\n[[p.{i + 1}]]\n{texto}')
    return '\n'.join(partes)


def main() -> int:
    if not SRC.is_dir():
        print(f'docs/Books não encontrado em {SRC}', file=sys.stderr)
        return 1
    OUT.mkdir(exist_ok=True)
    for f in sorted(SRC.iterdir()):
        if f.suffix.lower() not in ('.epub', '.pdf'):
            continue
        dest = OUT / (slug(f.name) + '.txt')
        try:
            txt = de_epub(f) if f.suffix.lower() == '.epub' else de_pdf(f)
        except Exception as e:
            print(f'FALHOU {f.name}: {e}', file=sys.stderr)
            continue
        dest.write_text(txt, encoding='utf-8')
        print(f'{dest.name}: {len(txt):,} chars')
    return 0


if __name__ == '__main__':
    sys.exit(main())
