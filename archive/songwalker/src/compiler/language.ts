const LANGUAGE = {
    'swe-comment': /(\/\/).*$/m,
    'swe-track': /(?=async\s+)?\btrack\b\s*([$\w][$\w]+)\(((?:[^()]|\([^()]*\))*)\)\s*{/,
    'swe-loop': /(?:for|while)\s*\((?:[^()]|\([^()]*\))*\)/,
    // 'track-statement': /\|([a-zA-Z][^@^=;().\s]*)((?:[@^][^@^=;()\s]+)*)(?:\(((?:[^()]|\([^()]*\))*)\))?;?/,
    'swe-func': /\b((?:(?:const|let)\s*)?[\w.]+\s*=\s*)?(await\s+)?\b([$\w][$\w.]+)((?:[@^][^@^=;()\s]+)*)\(((?:[^()]|\([^()]*\))*)\);?/,
    'swe-var': /((const|let|var)\s*)?[\w.]+\s*=[^\n;]+;?/,
    'swe-func-def': /(?=async\s+)?\bfunction\b\s*([$\w][$\w]+)(\((?:[^()]|\([^()]*\))*\))\s*{/,
    'swe-cmd': /\b([a-zA-Z][a-zA-Z0-9]*)((?:[@^][^@^=;()\s]+)*);?/,
    'swe-wait': /(\d*[\/.]?\d+);?/
}
export default LANGUAGE
