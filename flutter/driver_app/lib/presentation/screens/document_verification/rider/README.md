# Rider Document Verification Flow

This directory contains the **4-stage document verification flow for riders** in the driver app.

## 📋 Screens Overview

### Step 1: Personal Information (`step1_personal_info_screen.dart`)
**Progress: 20% (Step 1 of 5)**

Collects rider's personal details:
- Full name
- Date of birth (must be 18+)
- Email address
- Home address
- NIN (National Identification Number) - 11 digits
- Selfie check (camera capture)

### Step 2: Driver License (`step2_driver_license_screen.dart`)
**Progress: 40% (Step 2 of 5)**

Uploads driver license documentation:
- License front photo (camera or gallery)
- License back photo (camera or gallery)
- License number
- Expiry date (must be future date)

### Step 3: Vehicle Documents (`step3_vehicle_docs_screen.dart`)
**Progress: 60% (Step 3 of 5)**

Collects vehicle information and documents:
- Plate number
- Make and model
- Year
- Color
- Vehicle registration (required)
- Insurance certificate (required)
- Roadworthiness certificate (optional)
- Proof of ownership (optional)
- Vehicle photos: 4 photos (front, back, both sides)

### Step 4: Background Check (`step4_background_check_screen.dart`)
**Progress: 80% (Step 4 of 5)**

Final verification step:

**Guarantor Information:**
- Full name
- Phone number
- Relationship to rider
- Home address

**Emergency Contact:**
- Name
- Phone number

**Agreements:**
- Identity and safety background check consent
- Terms and Privacy Policy acceptance

## 🚀 How to Use

### Starting the Flow

To launch the rider verification flow from anywhere in your app:

```dart
import 'package:driver_app/presentation/screens/document_verification/rider/step1_personal_info_screen.dart';

// Navigate to start of verification
Navigator.of(context).push(
  MaterialPageRoute(
    builder: (context) => const RiderStep1PersonalInfoScreen(),
  ),
);
```

### Flow Navigation

The flow automatically progresses through all 4 steps:

1. **Step 1** → (Save and continue) → **Step 2**
2. **Step 2** → (Save and continue) → **Step 3**
3. **Step 3** → (Submit for review) → **Step 4**
4. **Step 4** → (Submit for check) → **Verification Screen**

After completing Step 4, the user is redirected to the `DocumentVerificationScreen` which shows the overall verification status.

### Back Navigation

Each screen has a back button that allows users to:
- Review previous information
- Make changes before final submission
- Exit the flow (with confirmation if needed)

## 🎨 UI Features

### Consistent Design Elements

1. **Progress Header** - Shows current step (1-5) and percentage complete
2. **Info Banners** - Contextual help for each section
3. **Form Validation** - Real-time validation with error messages
4. **Image Preview** - Display uploaded photos with edit/retake options
5. **Status Indicators** - Visual feedback for uploaded/required items

### Color Coding

- **Primary Blue** (`#2563EB`) - Actions and progress
- **Success Green** (`#10B981`) - Uploaded/verified items
- **Error Red** (`#DC3545`) - Required/missing items
- **Card Background** (`#1C2128`) - Form sections

## ✅ Validation Rules

### Personal Information
- Full name: Required, non-empty
- Date of birth: Required, must be 18+ years old
- Email: Required, must contain @
- Address: Required, non-empty
- NIN: Required, exactly 11 digits
- Selfie: Required

### Driver License
- License photos: Both front and back required
- License number: Required, non-empty
- Expiry date: Required, must be future date

### Vehicle Documents
- Plate number: Required
- Make and model: Required
- Year: Required, numeric
- Color: Required
- Registration: Required (photo)
- Insurance: Required (photo)
- Roadworthiness: Optional (photo)
- Ownership: Optional (photo)
- Vehicle photos: Up to 4 photos

### Background Check
- Guarantor name: Required
- Guarantor phone: Required, minimum 11 digits
- Guarantor relationship: Required
- Guarantor address: Required
- Emergency name: Required
- Emergency phone: Required, minimum 11 digits
- Background check consent: Must be checked
- Terms acceptance: Must be checked

## 🔧 Customization

### Modifying Progress Steps

To change the step numbering or percentage:

```dart
// In each screen's _buildProgressHeader() method
Container(
  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
  decoration: BoxDecoration(
    color: AppColors.primaryAccent,
    borderRadius: BorderRadius.circular(20),
  ),
  child: const Text(
    'Step X of Y',  // Change here
    style: TextStyle(
      fontSize: 12,
      fontWeight: FontWeight.w600,
      color: Colors.white,
    ),
  ),
),
```

### Adding Additional Fields

To add new fields to any step:

1. Add controller: `final _newFieldController = TextEditingController();`
2. Dispose it: `_newFieldController.dispose();` in `dispose()` method
3. Add the field in the form with validation

### Changing Navigation Flow

To change where Step 4 navigates after submission:

```dart
// In step4_background_check_screen.dart, _submitForCheck() method
Navigator.of(context).pushAndRemoveUntil(
  MaterialPageRoute(
    builder: (context) => const YourCustomScreen(), // Change here
  ),
  (route) => false,
);
```

## 📱 Testing

### Manual Testing Checklist

- [ ] Step 1: Fill all fields and take selfie
- [ ] Step 2: Upload both license sides
- [ ] Step 3: Upload required documents and vehicle photos
- [ ] Step 4: Fill guarantor info and check both agreements
- [ ] Back navigation works on all screens
- [ ] Form validation shows appropriate errors
- [ ] Images display correctly after upload
- [ ] Final submission navigates to verification screen

### Test Data

Use these sample values for testing:

```
Personal Info:
- Name: John Doe
- DOB: 01/01/1990
- Email: john.doe@example.com
- Address: 123 Main St, Lagos, Nigeria
- NIN: 12345678901

Driver License:
- License Number: ABC123XYZ
- Expiry: 31/12/2025

Vehicle:
- Plate: ABC-123-XY
- Make/Model: Toyota Corolla
- Year: 2020
- Color: Black

Guarantor:
- Name: Jane Smith
- Phone: 08012345678
- Relationship: Sister
- Address: 456 Oak St, Lagos

Emergency:
- Name: Mike Johnson
- Phone: 08098765432
```

## 🐛 Known Issues

1. **withOpacity deprecation** - Using deprecated API, should migrate to `withValues()` in future
2. **const constructors** - Some constructors could be const for better performance
3. **Image size** - Large images may cause memory issues on low-end devices

## 🔮 Future Enhancements

- [ ] Add image compression before upload
- [ ] Implement auto-save (draft state)
- [ ] Add OCR for license number extraction
- [ ] Real-time document validation
- [ ] Progress persistence across app restarts
- [ ] Multi-language support
- [ ] Accessibility improvements
- [ ] Backend API integration

## 📞 Integration Points

### Backend API Endpoints (To be implemented)

```dart
// Step 1 - Personal Info
POST /api/v1/rider/verification/personal-info
{
  "fullName": "string",
  "dateOfBirth": "string",
  "email": "string",
  "address": "string",
  "nin": "string",
  "selfie": "base64_image"
}

// Step 2 - Driver License
POST /api/v1/rider/verification/driver-license
{
  "licenseFront": "base64_image",
  "licenseBack": "base64_image",
  "licenseNumber": "string",
  "expiryDate": "string"
}

// Step 3 - Vehicle Documents
POST /api/v1/rider/verification/vehicle-documents
{
  "plateNumber": "string",
  "makeModel": "string",
  "year": "number",
  "color": "string",
  "registration": "base64_image",
  "insurance": "base64_image",
  "roadworthiness": "base64_image",
  "ownership": "base64_image",
  "vehiclePhotos": ["base64_image"]
}

// Step 4 - Background Check
POST /api/v1/rider/verification/background-check
{
  "guarantor": {
    "name": "string",
    "phone": "string",
    "relationship": "string",
    "address": "string"
  },
  "emergencyContact": {
    "name": "string",
    "phone": "string"
  },
  "agreements": {
    "backgroundCheck": true,
    "termsAccepted": true
  }
}
```

## 📚 Related Files

- `../document_verification_screen.dart` - Shows overall verification status
- `../../../../core/theme/app_colors.dart` - Color constants
- `../../../../core/constants/app_constants.dart` - App-wide constants

---

**Created:** 2026-10-10  
**Last Updated:** 2026-10-10  
**Version:** 1.0.0
