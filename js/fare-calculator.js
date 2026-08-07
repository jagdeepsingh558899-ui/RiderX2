/**
 * RiderX - Dynamic Fare Calculation Engine
 */

const FareCalculator = {
  // Base rates per service type
  rates: {
    bike: { baseFare: 20, perKm: 8, perMin: 1.5, minFare: 30 },
    cab: { baseFare: 50, perKm: 15, perMin: 2.5, minFare: 80 },
    parcel: { baseFare: 30, perKm: 10, perMin: 2.0, minFare: 40 },
    food: { baseFare: 25, perKm: 9, perMin: 1.5, minFare: 35 }
  },

  /**
   * Calculate distance using Haversine Formula (KM)
   */
  calculateDistance: function (lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in KM
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  },

  /**
   * Estimate ride duration in minutes based on average speed (30 km/h)
   */
  estimateTimeMinutes: function (distanceKm) {
    const avgSpeedKmH = 30;
    return Math.max(Math.ceil((distanceKm / avgSpeedKmH) * 60), 5);
  },

  /**
   * Calculate total fare for a selected service
   */
  calculateFare: function (serviceType, distanceKm, timeMin = null) {
    const service = this.rates[serviceType] || this.rates.bike;
    const duration = timeMin || this.estimateTimeMinutes(distanceKm);

    let calculated = service.baseFare + (distanceKm * service.perKm) + (duration * service.perMin);
    let finalFare = Math.max(calculated, service.minFare);

    return {
      serviceType: serviceType,
      distanceKm: distanceKm,
      durationMin: duration,
      fare: Math.round(finalFare)
    };
  }
};
