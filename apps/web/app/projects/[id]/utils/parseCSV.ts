export const parseCSV = (text: string): any[] => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  // Find the header row
  let headerIndex = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes('title') && lines[i].toLowerCase().includes('description')) {
      headerIndex = i
      break
    }
  }
  
  if (headerIndex === -1) {
    throw new Error('Could not find CSV header row')
  }
  
  // Parse header - detect delimiter (semicolon for CSV, tab for TSV)
  const headerLine = lines[headerIndex]
  const delimiter = headerLine.includes('\t') ? '\t' : ';'
  const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase())
  
  const titleIdx = headers.indexOf('title')
  const descriptionIdx = headers.indexOf('description')
  const labelIdx = headers.indexOf('label')
  const automatedIdx = headers.indexOf('automated')
  const priorityIdx = headers.indexOf('priority')
  const preconditionIdx = headers.indexOf('precondition')
  const scenarioIdx = headers.indexOf('scenario')
  const regressionIdx = headers.indexOf('regression')
  const epicLinkIdx = headers.indexOf('epic_link')
  const linkIssueIdx = headers.indexOf('link_issue')
  const platformIdx = headers.indexOf('platform')
  const fixVersionIdx = headers.indexOf('fix_version')
  const severityIdx = headers.indexOf('severity')
  
  if (titleIdx === -1) {
    throw new Error('Title column not found in CSV')
  }
  
  const testCases: any[] = []
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.trim().length === 0) continue
    
    let fullLine = line
    let quoteCount = (fullLine.match(/"/g) || []).length
    while (quoteCount % 2 !== 0 && i + 1 < lines.length) {
      i++
      fullLine += '\n' + lines[i]
      quoteCount = (fullLine.match(/"/g) || []).length
    }
    
    const values: string[] = []
    let currentValue = ''
    let inQuotes = false
    
    for (let j = 0; j < fullLine.length; j++) {
      const char = fullLine[j]
      const nextChar = fullLine[j + 1]
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentValue += '"'
          j++
        } else {
          inQuotes = !inQuotes
        }
      } else if ((char === delimiter || (delimiter === '\t' && char === '\t')) && !inQuotes) {
        // Field separator
        values.push(currentValue)
        currentValue = ''
      } else {
        currentValue += char
      }
    }
    values.push(currentValue)
    
    const trimmedValues = values.map(v => v.trim())
    const title = trimmedValues[titleIdx]?.trim()
    if (!title || title.length === 0) continue
    
    const automated = trimmedValues[automatedIdx]?.toLowerCase() === 'yes'
    const regression = trimmedValues[regressionIdx]?.toLowerCase() === 'yes'
    
    let priority = 2
    const priorityStr = trimmedValues[priorityIdx]?.toLowerCase()
    if (priorityStr === 'low') priority = 1
    else if (priorityStr === 'medium') priority = 2
    else if (priorityStr === 'high') priority = 3
    
    const severity = trimmedValues[severityIdx]?.trim() || 'Moderate'
    
    let labels = trimmedValues[labelIdx]?.trim() || ''
    if (labels) {
      labels = labels.replace(/;/g, ',')
    }
    
    let platformArray: string[] = []
    const platformStr = trimmedValues[platformIdx]?.trim() || ''
    if (platformStr) {
      platformArray = platformStr
        .split(/[;,]/)
        .map(p => p.trim().toLowerCase())
        .filter(p => p.length > 0)
    }
    
    const dataJson: any = {}
    if (trimmedValues[preconditionIdx]?.trim()) {
      dataJson.preconditions = trimmedValues[preconditionIdx].trim()
      dataJson.preconditionsMode = 'free_text'
    }
    if (trimmedValues[scenarioIdx]?.trim()) {
      dataJson.bddScenarios = trimmedValues[scenarioIdx].trim()
    }
    
    const toOptional = (val: string) => val && val.trim() ? val.trim() : undefined
    
    testCases.push({
      title,
      description: toOptional(trimmedValues[descriptionIdx] || ''),
      labels: toOptional(labels),
      automated,
      priority,
      severity,
      regression,
      epicLink: toOptional(trimmedValues[epicLinkIdx] || ''),
      linkedIssue: toOptional(trimmedValues[linkIssueIdx] || ''),
      releaseVersion: toOptional(trimmedValues[fixVersionIdx] || ''),
      platform: platformArray.length > 0 ? JSON.stringify(platformArray) : undefined,
      data: Object.keys(dataJson).length > 0 ? dataJson : undefined,
    })
  }
  
  return testCases
}

