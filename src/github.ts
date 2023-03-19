import crypto from 'crypto';
import fetch from 'node-fetch';
import * as storage from './storage.js';

/**
 * Code specific to communicating with the Fitbit API.
 */

export interface OAuthTokens {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    token_type: string;
    user_id: string;
  }
  
  export interface WebhookBody {
    collectionType: string; // body
    date: string; // 2022-11-18
    ownerId: string; // 29H3VW
    ownerType: string; // user
    subscriptionId: string; // 940311281653645353
  }
  
  export interface ProfileData {
    user: {
      aboutMe: string;
      age: string;
      ambassador: string;
      autoStrideEnabled: string;
      avatar: string;
      avatar150: string;
      avatar640: string;
      averageDailySteps: string;
      challengesBeta: string;
      clockTimeDisplayFormat: string;
      country: string;
      corporate: string;
      corporateAdmin: string;
      dateOfBirth: string;
      displayName: string;
      displayNameSetting: string;
      distanceUnit: string;
      encodedId: string;
      features: {
        exerciseGoal: string;
      };
      firstName: string;
      foodsLocale: string;
      fullName: string;
      gender: string;
      glucoseUnit: string;
      height: string;
      heightUnit: string;
      isBugReportEnabled: string;
      isChild: string;
      isCoach: string;
      languageLocale: string;
      lastName: string;
      legalTermsAcceptRequired: string;
      locale: string;
      memberSince: string;
      mfaEnabled: string;
      offsetFromUTCMillis: string;
      sdkDeveloper: string;
      sleepTracking: string;
      startDayOfWeek: string;
      state: string;
      strideLengthRunning: string;
      strideLengthRunningType: string;
      strideLengthWalking: string;
      strideLengthWalkingType: string;
      swimUnit: string;
      temperatureUnit: string;
      timezone: string;
      topBadges: [
        {
          badgeGradientEndColor: string;
          badgeGradientStartColor: string;
          badgeType: string;
          category: string;
          cheers: string[];
          dateTime: string;
          description: string;
          earnedMessage: string;
          encodedId: string;
          image100px: string;
          image125px: string;
          image300px: string;
          image50px: string;
          image75px: string;
          marketingDescription: string;
          mobileDescription: string;
          name: string;
          shareImage640px: string;
          shareText: string;
          shortDescription: string;
          shortName: string;
          timesAchieved: number;
          value: number;
        }
      ];
      waterUnit: string;
      waterUnitName: string;
      weight: string;
      weightUnit: string;
    };
  }