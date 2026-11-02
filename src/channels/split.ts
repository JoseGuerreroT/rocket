/**
 * Parte un mensaje largo en trozos de hasta `max` caracteres. Corta entre párrafos, si no
 * entre líneas y, como último recurso, entre palabras: Instagram rechaza más de 1.000.
 */
export const splitMessage = (text: string, max: number): string[] => {
    const parts: string[] = []
    let rest = text.trim()
    while (rest.length > max) {
        const window = rest.slice(0, max + 1)
        const cut = ['\n\n', '\n', ' '].map((separator) => window.lastIndexOf(separator)).find((i) => i > max / 2) ?? max
        parts.push(rest.slice(0, cut).trim())
        rest = rest.slice(cut).trim()
    }
    if (rest) parts.push(rest)
    return parts
}
