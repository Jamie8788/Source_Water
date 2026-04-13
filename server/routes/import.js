const router = require('express').Router()
const db = require('../db/connection')

// ── BULK CSV IMPORT ──────────────────────────────────────────────────
router.post('/csv', async (req, res) => {
  try {
    const { rows } = req.body // Array of CSV objects
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows provided' })
    }

    // Group by unique site (lat/lon)
    const siteMap = new Map()
    const siteToObservations = new Map()

    for (const row of rows) {
      const lat = parseFloat(row.MonitoringLocationLatitude)
      const lon = parseFloat(row.MonitoringLocationLongitude)
      const siteName = row.MonitoringLocationName || `${lat.toFixed(4)}, ${lon.toFixed(4)}`
      const siteKey = `${lat},${lon}`
      const dataset = row.DatasetName || 'Community Dataset'

      // Create or get site
      if (!siteMap.has(siteKey)) {
        siteMap.set(siteKey, {
          name: siteName,
          latitude: lat,
          longitude: lon,
          body_of_water: row.MonitoringLocationType || 'Water Body',
          organization: dataset,
          water_body_type: row.MonitoringLocationType || 'Lake/Pond'
        })
      }

      // Add observation row to site
      if (!siteToObservations.has(siteKey)) {
        siteToObservations.set(siteKey, [])
      }
      siteToObservations.get(siteKey).push(row)
    }

    // ── Create sites and observations ──
    const results = {
      sites_created: 0,
      observations_created: 0,
      errors: []
    }

    for (const [siteKey, siteData] of siteMap.entries()) {
      try {
        // Create site
        const site = await db.run(
          `INSERT INTO sites (name, latitude, longitude, body_of_water, organization, water_body_type)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [siteData.name, siteData.latitude, siteData.longitude, siteData.body_of_water, siteData.organization, siteData.water_body_type]
        )

        // Get site ID (either newly created or existing)
        const existingSite = await db.get(
          `SELECT id FROM sites WHERE latitude = ? AND longitude = ?`,
          [siteData.latitude, siteData.longitude]
        )
        const siteId = site?.id || existingSite?.id

        if (!siteId) {
          results.errors.push(`Failed to create/find site: ${siteData.name}`)
          continue
        }

        // Group observations by date
        const dateMap = new Map()
        const observations = siteToObservations.get(siteKey)

        for (const row of observations) {
          const dateKey = row.ActivityStartDate
          if (!dateMap.has(dateKey)) {
            dateMap.set(dateKey, {})
          }

          // Map characteristic name to column
          const char = row.CharacteristicName || ''
          const value = parseFloat(row.ResultValue)

          // Column mapping
          if (char.includes('pH')) dateMap.get(dateKey).ph = value
          else if (char.includes('Temperature, water')) dateMap.get(dateKey).water_temp = value
          else if (char.includes('Temperature, air')) dateMap.get(dateKey).air_temp = value
          else if (char.includes('Dissolved oxygen') || char.includes('DO')) dateMap.get(dateKey).dissolved_oxygen = value
          else if (char.includes('Conductivity')) dateMap.get(dateKey).conductivity = value
          else if (char.includes('Alkalinity')) dateMap.get(dateKey).alkalinity = value
          else if (char.includes('hardness')) dateMap.get(dateKey).hardness = value
          else if (char.includes('Turbidity')) dateMap.get(dateKey).turbidity = value
          else if (char.includes('Nitrate')) dateMap.get(dateKey).nitrate_nitrogen = value
          else if (char.includes('Chlorophyll')) dateMap.get(dateKey).chlorophyll_a = value
          else if (char.includes('Phosphorus')) dateMap.get(dateKey).phosphorus = value
          else if (char.includes('Chloride')) dateMap.get(dateKey).chloride = value
          else if (char.includes('Nitrite')) dateMap.get(dateKey).nitrites = value
          else if (char.includes('TDS')) dateMap.get(dateKey).tds = value
          else if (char.includes('Secchi')) dateMap.get(dateKey).secchi_depth = value
        }

        // Create observations for each date
        for (const [dateStr, data] of dateMap.entries()) {
          try {
            const dateObj = new Date(dateStr)
            await db.run(
              `INSERT INTO observations (
                site_id, observed_at,
                ph, dissolved_oxygen, water_temp, air_temp,
                conductivity, alkalinity, hardness, turbidity,
                nitrate_nitrogen, chlorophyll_a, phosphorus,
                chloride, nitrites, tds, secchi_depth
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                siteId, dateObj,
                data.ph || null, data.dissolved_oxygen || null,
                data.water_temp || null, data.air_temp || null,
                data.conductivity || null, data.alkalinity || null,
                data.hardness || null, data.turbidity || null,
                data.nitrate_nitrogen || null, data.chlorophyll_a || null,
                data.phosphorus || null, data.chloride || null,
                data.nitrites || null, data.tds || null,
                data.secchi_depth || null
              ]
            )
            results.observations_created++
          } catch (err) {
            results.errors.push(`Error creating observation for ${siteData.name} on ${dateStr}: ${err.message}`)
          }
        }

        results.sites_created++
      } catch (err) {
        results.errors.push(`Error creating site ${siteData.name}: ${err.message}`)
      }
    }

    res.json(results)
  } catch (err) {
    console.error('[Import] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
