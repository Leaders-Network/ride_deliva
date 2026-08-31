import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { logger } from '@/config/logger';

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting database seeding...');

  try {
    // Clear existing data (in development only)
    if (process.env.NODE_ENV === 'development') {
      logger.info('Clearing existing data...');
      
      // Delete in correct order due to foreign key constraints
      await prisma.review.deleteMany();
      await prisma.rideTrackingPoint.deleteMany();
      await prisma.deliveryTrackingPoint.deleteMany();
      await prisma.payment.deleteMany();
      await prisma.ride.deleteMany();
      await prisma.delivery.deleteMany();
      await prisma.driverEarning.deleteMany();
      await prisma.driverLocation.deleteMany();
      await prisma.vehicle.deleteMany();
      await prisma.notification.deleteMany();
      await prisma.supportTicket.deleteMany();
      await prisma.transaction.deleteMany();
      await prisma.wallet.deleteMany();
      await prisma.address.deleteMany();
      await prisma.session.deleteMany();
      await prisma.verificationCode.deleteMany();
      await prisma.customerProfile.deleteMany();
      await prisma.driverProfile.deleteMany();
      await prisma.adminProfile.deleteMany();
      await prisma.user.deleteMany();
      
      logger.info('Existing data cleared');
    }

    // Create admin user
    const adminPasswordHash = await bcrypt.hash('admin123!@#', 12);
    const adminUser = await prisma.user.create({
      data: {
        phoneNumber: '+2348012345678',
        email: 'admin@ridedeliva.com',
        firstName: 'Admin',
        lastName: 'User',
        passwordHash: adminPasswordHash,
        isVerified: true,
        phoneVerifiedAt: new Date(),
        emailVerifiedAt: new Date(),
        adminProfile: {
          create: {
            role: 'SUPER_ADMIN',
            permissions: {
              canManageUsers: true,
              canManageDrivers: true,
              canViewAnalytics: true,
              canManageSystem: true,
            },
          },
        },
      },
    });

    logger.info('Admin user created', { id: adminUser.id });

    // Create sample customer users
    const customerPasswordHash = await bcrypt.hash('customer123', 12);
    const customers = await Promise.all([
      prisma.user.create({
        data: {
          phoneNumber: '+2348123456789',
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
          passwordHash: customerPasswordHash,
          isVerified: true,
          phoneVerifiedAt: new Date(),
          customerProfile: {
            create: {
              preferredLanguage: 'en',
              emergencyContact: {
                name: 'Jane Doe',
                phoneNumber: '+2348123456790',
                relationship: 'Spouse',
              },
              wallet: {
                create: {
                  balance: 5000.00,
                  currency: 'NGN',
                },
              },
            },
          },
        },
      }),
      prisma.user.create({
        data: {
          phoneNumber: '+2348123456780',
          email: 'alice.smith@example.com',
          firstName: 'Alice',
          lastName: 'Smith',
          passwordHash: customerPasswordHash,
          isVerified: true,
          phoneVerifiedAt: new Date(),
          customerProfile: {
            create: {
              preferredLanguage: 'en',
              wallet: {
                create: {
                  balance: 2500.00,
                  currency: 'NGN',
                },
              },
            },
          },
        },
      }),
    ]);

    // Create customer addresses
    const johnAddresses = await Promise.all([
      prisma.address.create({
        data: {
          userId: customers[0].id,
          type: 'HOME',
          title: 'Home',
          streetAddress: '123 Victoria Island Street',
          city: 'Lagos',
          state: 'Lagos',
          postalCode: '101001',
          country: 'Nigeria',
          latitude: 6.4281,
          longitude: 3.4219,
          isDefault: true,
        },
      }),
      prisma.address.create({
        data: {
          userId: customers[0].id,
          type: 'WORK',
          title: 'Office',
          streetAddress: '456 Ikoyi Business District',
          city: 'Lagos',
          state: 'Lagos',
          postalCode: '101001',
          country: 'Nigeria',
          latitude: 6.4474,
          longitude: 3.4553,
          isDefault: false,
        },
      }),
    ]);

    const aliceAddresses = await Promise.all([
      prisma.address.create({
        data: {
          userId: customers[1].id,
          type: 'HOME',
          title: 'Home',
          streetAddress: '789 Lekki Phase 1',
          city: 'Lagos',
          state: 'Lagos',
          postalCode: '101001',
          country: 'Nigeria',
          latitude: 6.4698,
          longitude: 3.5852,
          isDefault: true,
        },
      }),
    ]);

    logger.info(`Created ${customers.length} customer users with addresses`);

    // Create sample driver users
    const driverPasswordHash = await bcrypt.hash('driver123', 12);
    const drivers = await Promise.all([
      prisma.user.create({
        data: {
          phoneNumber: '+2348098765432',
          email: 'michael.johnson@example.com',
          firstName: 'Michael',
          lastName: 'Johnson',
          passwordHash: driverPasswordHash,
          isVerified: true,
          phoneVerifiedAt: new Date(),
          driverProfile: {
            create: {
              licenseNumber: 'LOS001234567',
              licenseExpiryDate: new Date('2025-12-31'),
              licenseDocument: 'uploads/documents/drivers/license_001.pdf',
              status: 'APPROVED',
              isOnline: true,
              isAvailable: true,
              rating: 4.8,
              totalRides: 150,
              totalEarnings: 75000.00,
              bankAccount: {
                accountNumber: '1234567890',
                bankName: 'GTBank',
                accountName: 'Michael Johnson',
              },
              wallet: {
                create: {
                  balance: 12500.00,
                  currency: 'NGN',
                },
              },
            },
          },
        },
      }),
      prisma.user.create({
        data: {
          phoneNumber: '+2348087654321',
          email: 'david.brown@example.com',
          firstName: 'David',
          lastName: 'Brown',
          passwordHash: driverPasswordHash,
          isVerified: true,
          phoneVerifiedAt: new Date(),
          driverProfile: {
            create: {
              licenseNumber: 'LOS007654321',
              licenseExpiryDate: new Date('2026-06-30'),
              licenseDocument: 'uploads/documents/drivers/license_002.pdf',
              status: 'APPROVED',
              isOnline: true,
              isAvailable: false, // Currently on a trip
              rating: 4.6,
              totalRides: 89,
              totalEarnings: 44500.00,
              bankAccount: {
                accountNumber: '0987654321',
                bankName: 'First Bank',
                accountName: 'David Brown',
              },
              wallet: {
                create: {
                  balance: 8750.00,
                  currency: 'NGN',
                },
              },
            },
          },
        },
      }),
    ]);

    // Create vehicles for drivers
    const vehicles = await Promise.all([
      prisma.vehicle.create({
        data: {
          driverId: drivers[0].driverProfile!.id,
          type: 'SEDAN',
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          color: 'Silver',
          licensePlate: 'LAG-123-ABC',
          registrationDoc: 'uploads/documents/vehicles/reg_001.pdf',
          insuranceDoc: 'uploads/documents/vehicles/ins_001.pdf',
          isActive: true,
          capacity: {
            seats: 4,
            luggage: 'Medium',
          },
          features: {
            airConditioning: true,
            music: true,
            phoneCharger: true,
          },
        },
      }),
      prisma.vehicle.create({
        data: {
          driverId: drivers[1].driverProfile!.id,
          type: 'SUV',
          make: 'Honda',
          model: 'Pilot',
          year: 2019,
          color: 'Black',
          licensePlate: 'LAG-456-XYZ',
          registrationDoc: 'uploads/documents/vehicles/reg_002.pdf',
          insuranceDoc: 'uploads/documents/vehicles/ins_002.pdf',
          isActive: true,
          capacity: {
            seats: 7,
            luggage: 'Large',
          },
          features: {
            airConditioning: true,
            music: true,
            phoneCharger: true,
            wiFi: true,
          },
        },
      }),
    ]);

    // Create driver locations
    const driverLocations = await Promise.all([
      prisma.driverLocation.create({
        data: {
          driverId: drivers[0].driverProfile!.id,
          latitude: 6.4281,
          longitude: 3.4219,
          heading: 45.0,
          speed: 0.0,
          accuracy: 5.0,
          isOnline: true,
          isAvailable: true,
        },
      }),
      prisma.driverLocation.create({
        data: {
          driverId: drivers[1].driverProfile!.id,
          latitude: 6.4474,
          longitude: 3.4553,
          heading: 180.0,
          speed: 25.0,
          accuracy: 3.0,
          isOnline: true,
          isAvailable: false,
        },
      }),
    ]);

    logger.info(`Created ${drivers.length} driver users with vehicles and locations`);

    // Create sample rides
    const rides = await Promise.all([
      // Completed ride
      prisma.ride.create({
        data: {
          rideCode: 'RD202608290001',
          customerId: customers[0].customerProfile!.id,
          driverId: drivers[0].driverProfile!.id,
          vehicleId: vehicles[0].id,
          pickupAddressId: johnAddresses[0].id,
          destinationAddressId: johnAddresses[1].id,
          status: 'COMPLETED',
          rideType: 'STANDARD',
          passengerCount: 1,
          requestedAt: new Date('2026-08-29T08:00:00Z'),
          acceptedAt: new Date('2026-08-29T08:02:00Z'),
          arrivedAt: new Date('2026-08-29T08:10:00Z'),
          startedAt: new Date('2026-08-29T08:12:00Z'),
          completedAt: new Date('2026-08-29T08:35:00Z'),
          estimatedFare: 2500.00,
          finalFare: 2300.00,
          surgeMultiplier: 1.0,
          estimatedDistance: 8.5,
          actualDistance: 8.2,
          estimatedDuration: 25,
          actualDuration: 23,
        },
      }),
      // In progress ride
      prisma.ride.create({
        data: {
          rideCode: 'RD202608290002',
          customerId: customers[1].customerProfile!.id,
          driverId: drivers[1].driverProfile!.id,
          vehicleId: vehicles[1].id,
          pickupAddressId: aliceAddresses[0].id,
          destinationAddressId: johnAddresses[0].id,
          status: 'IN_PROGRESS',
          rideType: 'PREMIUM',
          passengerCount: 2,
          requestedAt: new Date('2026-08-29T10:00:00Z'),
          acceptedAt: new Date('2026-08-29T10:01:30Z'),
          arrivedAt: new Date('2026-08-29T10:08:00Z'),
          startedAt: new Date('2026-08-29T10:10:00Z'),
          estimatedFare: 3200.00,
          surgeMultiplier: 1.2,
          estimatedDistance: 12.3,
          estimatedDuration: 35,
        },
      }),
    ]);

    // Create payment for completed ride
    await prisma.payment.create({
      data: {
        rideId: rides[0].id,
        amount: 2300.00,
        currency: 'NGN',
        method: 'WALLET',
        status: 'COMPLETED',
        reference: 'PAY_RD_001_' + Date.now(),
      },
    });

    // Create review for completed ride
    await prisma.review.create({
      data: {
        rideId: rides[0].id,
        customerId: customers[0].customerProfile!.id,
        driverId: drivers[0].driverProfile!.id,
        rating: 5,
        comment: 'Excellent service! Driver was professional and the ride was smooth.',
        isPublic: true,
      },
    });

    logger.info(`Created ${rides.length} sample rides with payments and reviews`);

    // Create sample deliveries
    const deliveries = await prisma.delivery.create({
      data: {
        deliveryCode: 'DL202608290001',
        customerId: customers[0].customerProfile!.id,
        driverId: drivers[0].driverProfile!.id,
        vehicleId: vehicles[0].id,
        pickupAddressId: johnAddresses[1].id,
        destinationAddressId: johnAddresses[0].id,
        status: 'DELIVERED',
        deliveryType: 'STANDARD',
        packageDetails: {
          description: 'Documents and small parcel',
          weight: 2.5,
          dimensions: {
            length: 30,
            width: 20,
            height: 15,
          },
        },
        senderInfo: {
          name: 'John Doe',
          phoneNumber: '+2348123456789',
        },
        recipientInfo: {
          name: 'Jane Doe',
          phoneNumber: '+2348123456790',
        },
        requestedAt: new Date('2026-08-29T14:00:00Z'),
        acceptedAt: new Date('2026-08-29T14:05:00Z'),
        pickedUpAt: new Date('2026-08-29T14:15:00Z'),
        deliveredAt: new Date('2026-08-29T14:45:00Z'),
        estimatedFare: 1500.00,
        finalFare: 1500.00,
        estimatedDistance: 5.2,
        actualDistance: 5.0,
        estimatedDuration: 20,
        actualDuration: 18,
        proofOfDelivery: 'uploads/deliveries/proof/proof_001.jpg',
      },
    });

    logger.info('Created sample delivery');

    // Create sample notifications
    const notifications = await Promise.all([
      prisma.notification.create({
        data: {
          userId: customers[0].id,
          type: 'RIDE_COMPLETED',
          title: 'Ride Completed',
          message: 'Your ride to Ikoyi Business District has been completed successfully.',
          data: {
            rideId: rides[0].id,
            rideCode: rides[0].rideCode,
            fare: rides[0].finalFare,
          },
          isRead: false,
        },
      }),
      prisma.notification.create({
        data: {
          userId: drivers[0].id,
          type: 'PAYMENT_RECEIVED',
          title: 'Payment Received',
          message: 'You have received ₦2,300 for your completed ride.',
          data: {
            amount: 2300.00,
            rideId: rides[0].id,
          },
          isRead: true,
          readAt: new Date(),
        },
      }),
    ]);

    logger.info(`Created ${notifications.length} sample notifications`);

    // Create sample support tickets
    const supportTickets = await Promise.all([
      prisma.supportTicket.create({
        data: {
          ticketCode: 'TKT202608290001',
          userId: customers[0].id,
          category: 'RIDE_ISSUE',
          priority: 'MEDIUM',
          status: 'RESOLVED',
          subject: 'Driver took longer route',
          description: 'The driver took a longer route than necessary, increasing the fare.',
          resolution: 'Fare adjusted and refunded the difference. Driver has been notified.',
          resolvedAt: new Date(),
        },
      }),
    ]);

    logger.info(`Created ${supportTickets.length} sample support tickets`);

    // Create wallet transactions
    const transactions = await Promise.all([
      // Credit transaction for customer
      prisma.transaction.create({
        data: {
          walletId: customers[0].customerProfile!.wallet!.id,
          type: 'CREDIT',
          amount: 5000.00,
          currency: 'NGN',
          status: 'COMPLETED',
          description: 'Initial wallet funding',
          reference: 'TXN_FUND_001_' + Date.now(),
        },
      }),
      // Debit transaction for ride payment
      prisma.transaction.create({
        data: {
          walletId: customers[0].customerProfile!.wallet!.id,
          type: 'DEBIT',
          amount: 2300.00,
          currency: 'NGN',
          status: 'COMPLETED',
          description: 'Payment for ride RD202608290001',
          reference: 'TXN_RIDE_001_' + Date.now(),
        },
      }),
      // Credit transaction for driver earnings
      prisma.transaction.create({
        data: {
          walletId: drivers[0].driverProfile!.wallet!.id,
          type: 'CREDIT',
          amount: 1840.00, // 80% of fare (20% commission)
          currency: 'NGN',
          status: 'COMPLETED',
          description: 'Earnings from ride RD202608290001',
          reference: 'TXN_EARN_001_' + Date.now(),
        },
      }),
    ]);

    logger.info(`Created ${transactions.length} sample transactions`);

    // Create driver earnings record
    await prisma.driverEarning.create({
      data: {
        driverId: drivers[0].driverProfile!.id,
        rideId: rides[0].id,
        grossAmount: 2300.00,
        commission: 460.00, // 20%
        netAmount: 1840.00,
        currency: 'NGN',
        earnedAt: new Date('2026-08-29T08:35:00Z'),
      },
    });

    logger.info('Created driver earnings record');

    logger.info('Database seeding completed successfully! 🎉');
    
    // Log summary
    console.log('\n📊 Seeding Summary:');
    console.log(`✅ 1 Admin user created`);
    console.log(`✅ ${customers.length} Customer users created`);
    console.log(`✅ ${drivers.length} Driver users created`);
    console.log(`✅ ${vehicles.length} Vehicles created`);
    console.log(`✅ ${rides.length} Rides created`);
    console.log(`✅ 1 Delivery created`);
    console.log(`✅ ${notifications.length} Notifications created`);
    console.log(`✅ ${supportTickets.length} Support tickets created`);
    console.log(`✅ ${transactions.length} Transactions created`);
    console.log('\n🔐 Test Credentials:');
    console.log('Admin: admin@ridedeliva.com / admin123!@#');
    console.log('Customer: john.doe@example.com / customer123');
    console.log('Driver: michael.johnson@example.com / driver123');

  } catch (error) {
    logger.error('Database seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });