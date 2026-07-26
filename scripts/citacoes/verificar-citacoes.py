#!/usr/bin/env python3
"""Confere que TODA citação de `src/lib/curadoria-evidencia.ts` existe de fato
na obra declarada.

Passo 2 de 2 (rode `extrair-corpus.py` antes). Sai com status != 0 se alguma
citação não for encontrada — é o que impede uma classificação de nascer de
proveniência inventada, e o que avisa se uma extração futura mudar.

Duas verificações, com rigor diferente de propósito:

1. **Campos `citacao:`** — casados contra o texto da obra em `fonte:`.
   Atribuição errada de autoria é o erro grave; por isso a fonte importa aqui.
2. **Trechos entre aspas duplas em `nota:`/`contraindicacao:`** — casados
   contra o corpus INTEIRO. São citações de apoio dentro de prosa em
   português, e a autoria já vem nomeada no próprio texto ("Too — ...").
   Convenção: aspas duplas são reservadas a citação de obra. Para referir
   texto do próprio app dentro dessa prosa, use «guilemetes» — senão este
   verificador (corretamente) cobra a frase do app como se fosse do livro.

Não é executado no `npm test`: depende de `docs/Books` e de `pypdf`, que não
existem no CI. É uma conferência manual, reproduzível.
"""
import re, sys, pathlib

RAIZ = pathlib.Path(__file__).resolve().parents[2]
CORPUS = RAIZ / '.corpus-txt'
CURADORIA = RAIZ / 'src' / 'lib' / 'curadoria-evidencia.ts'

# FonteId -> prefixo do arquivo gerado por extrair-corpus.py.
ARQUIVO_DA_FONTE = {
    'too-dicionario': 'feng-shui-dictionary',
    'erlewine-arte': 'the-art-of-feng-shui',
    'yap-wfh': 'feng-1-pdf',
    'tchikovani-casa': 'the-feng-shui-house-book',
    'williams-iniciantes': 'feng-shui-for-beginners-how-to-awaken',
    'alba-iniciantes': 'feng-shui-book-for-beginners',
    'morawa-riqueza': 'feng-shui-for-attracting-wealth',
}

MIN_APOIO = 25  # trechos curtos entre aspas não são citação, são ênfase


def normalizar(s: str) -> str:
    """Espaço colapsado e apóstrofos/aspas tipográficos unificados — a extração
    de PDF quebra linha em lugares arbitrários e varia a forma do apóstrofo."""
    s = s.replace('’', "'").replace('‘', "'")
    s = s.replace('“', '"').replace('”', '"')
    return re.sub(r'\s+', ' ', s).strip()


def carregar_corpus() -> dict[str, str]:
    if not CORPUS.is_dir():
        sys.exit(f'{CORPUS} não existe — rode extrair-corpus.py primeiro.')
    textos = {}
    for fid, prefixo in ARQUIVO_DA_FONTE.items():
        achados = [p for p in CORPUS.glob('*.txt') if p.stem.startswith(prefixo)]
        if not achados:
            sys.exit(f'Sem texto extraído para a fonte "{fid}" ({prefixo}*.txt)')
        textos[fid] = normalizar(achados[0].read_text(encoding='utf-8', errors='replace'))
    return textos


def ts_string(m: re.Match) -> str:
    """Conteúdo de uma string TS, resolvendo a escapagem de aspas simples."""
    return (m.group(2) or m.group(4) or '').replace("\\'", "'")


def main() -> int:
    corpus = carregar_corpus()
    fonte_texto = CURADORIA.read_text(encoding='utf-8')
    falhas, conferidas = [], 0

    # ── 1. citacao: casada contra a fonte declarada ──────────────────────
    # Cada `fonte:` é seguido, dentro da mesma entrada, por um `citacao:`.
    blocos = re.findall(
        r"fonte:\s*'([a-z-]+)'.*?citacao:\s*(?:'((?:[^'\\]|\\.)*)'|\"([^\"]*)\")",
        fonte_texto, re.S)
    for fid, aspas_simples, aspas_duplas in blocos:
        cit = normalizar((aspas_simples or aspas_duplas).replace("\\'", "'"))
        if fid not in corpus:
            falhas.append(f'[fonte desconhecida] {fid}')
            continue
        conferidas += 1
        if cit not in corpus[fid]:
            falhas.append(f'[não encontrada em {fid}] {cit[:90]}…')

    # ── 2. trechos de apoio: casados contra o corpus inteiro ─────────────
    tudo = ' ‖ '.join(corpus.values())
    for campo in ('nota', 'contraindicacao'):
        for m in re.finditer(rf"{campo}:\s*'((?:[^'\\]|\\.)*)'", fonte_texto, re.S):
            prosa = m.group(1).replace("\\'", "'")
            for apoio in re.findall(r'"([^"]+)"', prosa):
                if len(apoio) < MIN_APOIO:
                    continue
                conferidas += 1
                if normalizar(apoio) not in tudo:
                    falhas.append(f'[apoio em {campo} não encontrado] {apoio[:90]}…')

    if falhas:
        print(f'{len(falhas)} FALHA(S) de {conferidas} citações conferidas:\n')
        for f in falhas:
            print(f'  {f}')
        return 1
    print(f'OK — {conferidas} citações conferidas, todas presentes nas fontes.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
