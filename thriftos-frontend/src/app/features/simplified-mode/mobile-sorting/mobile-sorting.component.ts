import { Component, signal, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { API_BASE_URL } from '../../../core/config/api.config';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface CategoryItem {
  id: string;
  name: string;
}

interface GradeItem {
  id: string;
  name: string;
}

interface WasteCategoryItem {
  id: string;
  name: string;
}

interface RagItem {
  id: string;
  ragCode: string;
  weightKg: number;
  status: 'NOT_STARTED' | 'IN_SORTING' | 'SORTED';
  rawCategory?: { name: string };
  container?: { containerNumber: string };
  sortSession?: { id: string; sessionCode?: string };
}

interface CategoryOutputItem {
  id: string;
  categoryId: string;
  category?: { name: string };
  outputWeightKg: number;
  ragCode?: string;
  status?: string;
}

interface SortBucket {
  id: string;
  categoryId: string;
  category?: { name: string };
  outputWeightKg: number;
}

interface SortSessionData {
  id: string;
  sessionCode: string;
  status: string;
  rag: {
    id: string;
    ragCode: string;
    weightKg: number;
  };
  sortCategoryBuckets?: SortBucket[];
}

interface GradeBucket {
  id: string;
  gradeId: string;
  grade?: { name: string };
  outputWeightKg: number;
  outputCount: number;
}

interface GradeSessionData {
  id: string;
  sessionCode: string;
  status: string;
  categoryOutput: {
    outputWeightKg: number;
    category?: { name: string };
  };
  gradeBuckets?: GradeBucket[];
}

@Component({
  selector: 'app-mobile-sorting',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="mobile-sorting-view">
      <!-- Stage Selector Tabs -->
      <div class="stage-tabs">
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeStage() === 1"
          (click)="setStage(1)"
        >
          <span>⚡ Stage 1 — Category Sorting</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeStage() === 2"
          (click)="setStage(2)"
        >
          <span>🏷️ Stage 2 — Quality Grading</span>
        </button>
      </div>

      <!-- STATUS NOTIFICATION BANNER -->
      <div *ngIf="statusMessage()" role="status" aria-live="polite" class="status-alert" [class.success]="statusType() === 'success'" [class.error]="statusType() === 'error'">
        <span>{{ statusMessage() }}</span>
        <button type="button" class="dismiss-btn" (click)="statusMessage.set('')">✕</button>
      </div>

      <!-- ========================================================= -->
      <!-- STAGE 1 VIEW: CATEGORY SORTING WORKSTATION -->
      <!-- ========================================================= -->
      <div *ngIf="activeStage() === 1" class="sorting-form-card">
        <div class="card-header">
          <h3>⚡ Stage 1 Category Sorting Hub</h3>
          <span class="badge-tag">Category Level</span>
        </div>

        <!-- STEP A: NO ACTIVE SESSION — LIST VIEW (READY TO SORT & IN SORTING) -->
        <div *ngIf="!activeSortSession()" class="sessions-list-wrapper">
          <div class="list-controls-bar">
            <div class="filter-pills">
              <button
                type="button"
                class="filter-btn"
                [class.active]="ragStatusFilter() === 'ALL'"
                (click)="ragStatusFilter.set('ALL')"
              >
                All Rags ({{ allSortingRags().length }})
              </button>
              <button
                type="button"
                class="filter-btn green"
                [class.active]="ragStatusFilter() === 'NOT_STARTED'"
                (click)="ragStatusFilter.set('NOT_STARTED')"
              >
                🟢 Ready to Sort ({{ readyRagsCount() }})
              </button>
              <button
                type="button"
                class="filter-btn amber"
                [class.active]="ragStatusFilter() === 'IN_SORTING'"
                (click)="ragStatusFilter.set('IN_SORTING')"
              >
                🟡 In Sorting ({{ inSortingRagsCount() }})
              </button>
            </div>

            <button type="button" class="refresh-btn" (click)="fetchMasterData()">🔄 Refresh</button>
          </div>

          <div *ngIf="filteredRags().length === 0" class="empty-list-box">
            <p>No raw bales match the selected status filter.</p>
          </div>

          <!-- Desktop Table Layout -->
          <div *ngIf="filteredRags().length > 0" class="desktop-only">
            <table class="lite-table">
              <thead>
                <tr>
                  <th>Bale Code</th>
                  <th>Raw Category</th>
                  <th>Net Weight</th>
                  <th>Operational Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let rag of filteredRags(); trackBy: trackById">
                  <td class="font-mono font-bold">{{ rag.ragCode }}</td>
                  <td>{{ rag.rawCategory?.name || 'Raw Mix Bale' }}</td>
                  <td class="font-bold">{{ rag.weightKg }} KG</td>
                  <td>
                    <span
                      class="status-pill"
                      [class.not-started]="rag.status === 'NOT_STARTED'"
                      [class.in-sorting]="rag.status === 'IN_SORTING'"
                    >
                      <span class="dot"></span>
                      {{ rag.status === 'NOT_STARTED' ? 'Ready to Sort' : 'In Sorting' }}
                    </span>
                  </td>
                  <td>
                    <button
                      *ngIf="rag.status === 'NOT_STARTED'"
                      type="button"
                      class="start-action-btn"
                      (click)="startSortSessionForRag(rag.id)"
                    >
                      ⚡ Start Sort Session
                    </button>

                    <button
                      *ngIf="rag.status === 'IN_SORTING'"
                      type="button"
                      class="resume-action-btn"
                      (click)="resumeSortSessionForRag(rag)"
                    >
                      ▶️ Resume Session
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile Cards Stack Layout -->
          <div *ngIf="filteredRags().length > 0" class="mobile-only rags-card-stack">
            <div *ngFor="let rag of filteredRags(); trackBy: trackById" class="rag-list-card">
              <div class="card-top">
                <span class="bale-code">{{ rag.ragCode }}</span>
                <span
                  class="status-pill"
                  [class.not-started]="rag.status === 'NOT_STARTED'"
                  [class.in-sorting]="rag.status === 'IN_SORTING'"
                >
                  <span class="dot"></span>
                  {{ rag.status === 'NOT_STARTED' ? 'Ready to Sort' : 'In Sorting' }}
                </span>
              </div>

              <div class="card-meta">
                <span class="cat-name">{{ rag.rawCategory?.name || 'Raw Mix' }}</span>
                <span class="weight-tag">{{ rag.weightKg }} KG</span>
              </div>

              <div class="card-action">
                <button
                  *ngIf="rag.status === 'NOT_STARTED'"
                  type="button"
                  class="start-action-btn"
                  (click)="startSortSessionForRag(rag.id)"
                >
                  ⚡ Start Sort Session
                </button>

                <button
                  *ngIf="rag.status === 'IN_SORTING'"
                  type="button"
                  class="resume-action-btn"
                  (click)="resumeSortSessionForRag(rag)"
                >
                  ▶️ Resume Active Session
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- STEP B: ACTIVE SESSION WORKSTATION PANEL -->
        <div *ngIf="activeSortSession()" class="active-session-box">
          <div class="active-header-bar">
            <button type="button" class="back-link-btn" (click)="activeSortSession.set(null)">
              ← Back to Sessions List
            </button>
            <span class="active-tag">ACTIVE SORTING SESSION</span>
          </div>

          <div class="session-meta-pill">
            <div class="meta-item">
              <span class="lbl">Rag Code:</span>
              <span class="val highlight">{{ activeSortSession()?.rag?.ragCode || 'ACTIVE' }}</span>
            </div>
            <div class="meta-item">
              <span class="lbl">Input Weight:</span>
              <span class="val">{{ activeSortSession()?.rag?.weightKg }} KG</span>
            </div>
          </div>

          <!-- Live Weight Tracker Progress -->
          <div class="weight-tracker-bar">
            <div class="tracker-stats">
              <span>Logged: <strong>{{ totalStage1LoggedWeight() }} KG</strong></span>
              <span>Remaining: <strong class="rem">{{ remainingStage1Weight() }} KG</strong></span>
            </div>
            <div class="progress-bg">
              <div class="progress-fill" [style.width.%]="stage1YieldPct()"></div>
            </div>
          </div>

          <!-- Add Category Bucket Output Form -->
          <div class="bucket-entry-form">
            <label class="form-title">Log Category Output</label>
            
            <div class="category-chip-grid">
              <button
                type="button"
                *ngFor="let cat of categories(); trackBy: trackById"
                class="chip-btn"
                [class.selected]="selectedCategoryId === cat.id"
                (click)="selectedCategoryId = cat.id"
              >
                {{ cat.name }}
              </button>
            </div>

            <div class="weight-input-box">
              <input
                type="number"
                step="0.1"
                [(ngModel)]="outputWeight"
                placeholder="0.0"
                class="weight-field"
              />
              <span class="unit-tag">KG</span>
            </div>

            <!-- Quick Preset Weight Buttons -->
            <div class="preset-buttons">
              <button type="button" (click)="addPresetWeight(5)">+5</button>
              <button type="button" (click)="addPresetWeight(10)">+10</button>
              <button type="button" (click)="addPresetWeight(25)">+25</button>
              <button type="button" (click)="addPresetWeight(40)">+40</button>
            </div>

            <button
              type="button"
              class="add-bucket-btn"
              [disabled]="!selectedCategoryId || !outputWeight || isSubmitting()"
              (click)="addCategoryBucket()"
            >
              <span *ngIf="!isSubmitting()">+ Add Category Bucket</span>
              <span *ngIf="isSubmitting()">Adding...</span>
            </button>
          </div>

          <!-- Logged Buckets List -->
          <div *ngIf="stage1Buckets().length > 0" class="logged-buckets-list">
            <label class="form-title">Logged Category Buckets ({{ stage1Buckets().length }})</label>
            <div *ngFor="let b of stage1Buckets(); trackBy: trackById" class="bucket-row">
              <div class="bucket-info">
                <span class="cat-name">{{ b.category?.name || 'Category' }}</span>
                <span class="cat-weight">{{ b.outputWeightKg }} KG</span>
              </div>
              <button type="button" class="del-bucket-btn" (click)="deleteStage1Bucket(b.id)">🗑️</button>
            </div>
          </div>

          <!-- Complete Session Action -->
          @if (remainingStage1Weight() > 0) {
            <div class="waste-close-control">
              <strong>{{ remainingStage1Weight() }} KG remains</strong>
              <span>Choose the waste category required to close this Stage 1 session.</span>
              <select [(ngModel)]="selectedStage1WasteCategoryId">
                <option value="">Select waste category</option>
                @for (category of wasteCategories(); track category.id) {
                  <option [value]="category.id">{{ category.name }}</option>
                }
              </select>
            </div>
          }
          <button
            type="button"
            class="complete-session-btn"
            [disabled]="isSubmitting() || (remainingStage1Weight() > 0 && !selectedStage1WasteCategoryId)"
            (click)="closeSortSession()"
          >
            <span *ngIf="!isSubmitting()">✓ Complete & Close Session</span>
            <span *ngIf="isSubmitting()">Closing Session...</span>
          </button>
        </div>
      </div>

      <!-- ========================================================= -->
      <!-- STAGE 2 VIEW: QUALITY GRADING WORKSTATION -->
      <!-- ========================================================= -->
      <div *ngIf="activeStage() === 2" class="sorting-form-card">
        <div class="card-header">
          <h3>🏷️ Stage 2 Quality Grading</h3>
          <span class="badge-tag accent">Grade Level</span>
        </div>

        <!-- STEP A: NO ACTIVE GRADE SESSION — LIST VIEW OF CATEGORY OUTPUTS -->
        <div *ngIf="!activeGradeSession()" class="start-session-box">
          <p class="section-desc">Select a Category Output item to begin Quality Grading.</p>

          <div *ngIf="availableCategoryOutputs().length === 0" class="empty-list-box">
            <p>No category outputs ready for grading. Complete Stage 1 Sorting first.</p>
          </div>

          <div *ngIf="availableCategoryOutputs().length > 0" class="outputs-list-stack">
            <div *ngFor="let item of availableCategoryOutputs(); trackBy: trackById" class="output-item-card">
              <div class="item-meta font-bold">
                <span>{{ item.category?.name || 'Category Output' }}</span>
                <span class="weight-badge">{{ item.outputWeightKg }} KG</span>
              </div>
              <button
                type="button"
                class="start-action-btn secondary"
                (click)="startGradeSessionForOutput(item.id)"
              >
                🏷️ Start Quality Grading
              </button>
            </div>
          </div>
        </div>

        <!-- STEP B: ACTIVE GRADE SESSION WORKSTATION PANEL -->
        <div *ngIf="activeGradeSession()" class="active-session-box">
          <div class="active-header-bar">
            <button type="button" class="back-link-btn" (click)="activeGradeSession.set(null)">
              ← Back to Category Outputs
            </button>
            <span class="active-tag amber">ACTIVE GRADE SESSION</span>
          </div>

          <div class="session-meta-pill grade">
            <div class="meta-item">
              <span class="lbl">Category:</span>
              <span class="val highlight">{{ activeGradeSession()?.categoryOutput?.category?.name || 'Category' }}</span>
            </div>
            <div class="meta-item">
              <span class="lbl">Category Weight:</span>
              <span class="val">{{ activeGradeSession()?.categoryOutput?.outputWeightKg }} KG</span>
            </div>
          </div>

          <!-- Add Grade Bucket Output Form -->
          <div class="bucket-entry-form">
            <label class="form-title">Log Graded Output</label>

            <div class="category-chip-grid">
              <button
                type="button"
                *ngFor="let gr of grades(); trackBy: trackById"
                class="chip-btn grade"
                [class.selected]="selectedGradeId === gr.id"
                (click)="selectedGradeId = gr.id"
              >
                {{ gr.name }}
              </button>
            </div>

            <div class="weight-input-box">
              <input
                type="number"
                step="0.1"
                [(ngModel)]="gradeWeight"
                placeholder="0.0"
                class="weight-field"
              />
              <span class="unit-tag">KG</span>
            </div>

            <button
              type="button"
              class="add-bucket-btn secondary"
              [disabled]="!selectedGradeId || !gradeWeight || isSubmitting()"
              (click)="addGradeBucket()"
            >
              <span *ngIf="!isSubmitting()">+ Add Grade Output</span>
              <span *ngIf="isSubmitting()">Adding...</span>
            </button>
          </div>

          <!-- Logged Grade Buckets List -->
          <div *ngIf="stage2Buckets().length > 0" class="logged-buckets-list">
            <label class="form-title">Logged Grade Buckets ({{ stage2Buckets().length }})</label>
            <div *ngFor="let b of stage2Buckets(); trackBy: trackById" class="bucket-row">
              <div class="bucket-info">
                <span class="cat-name">{{ b.grade?.name || 'Grade' }}</span>
                <span class="cat-weight">{{ b.outputWeightKg }} KG</span>
              </div>
              <button type="button" class="del-bucket-btn" (click)="deleteStage2Bucket(b.id)">🗑️</button>
            </div>
          </div>

          <!-- Complete Grade Session Action -->
          @if (remainingStage2Weight() > 0) {
            <div class="waste-close-control">
              <strong>{{ remainingStage2Weight() }} KG remains</strong>
              <span>Choose the waste category required to close this Stage 2 session.</span>
              <select [(ngModel)]="selectedStage2WasteCategoryId">
                <option value="">Select waste category</option>
                @for (category of wasteCategories(); track category.id) {
                  <option [value]="category.id">{{ category.name }}</option>
                }
              </select>
            </div>
          }
          <button
            type="button"
            class="complete-session-btn secondary"
            [disabled]="isSubmitting() || (remainingStage2Weight() > 0 && !selectedStage2WasteCategoryId)"
            (click)="closeGradeSession()"
          >
            <span *ngIf="!isSubmitting()">✓ Complete & Close Grade Session</span>
            <span *ngIf="isSubmitting()">Closing Session...</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .mobile-sorting-view {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .waste-close-control { display: grid; gap: .35rem; padding: .85rem; border: 1px solid #fcd34d; border-radius: 9px; background: #fffbeb; color: #92400e; font-size: .8rem; }
    .waste-close-control strong { font-size: .9rem; }
    .waste-close-control select { min-height: 42px; padding: 0 .65rem; border: 1px solid #f59e0b; border-radius: 7px; background: #fff; color: #374151; font: inherit; }

    @media (min-width: 1024px) {
      .mobile-only { display: none !important; }
    }

    @media (max-width: 1023px) {
      .desktop-only { display: none !important; }
    }

    .stage-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: #e5e7eb;
      padding: 4px;
      border-radius: 12px;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .tab-btn {
      padding: 0.75rem 0.5rem;
      border: none;
      background: transparent;
      border-radius: 9px;
      font-size: 0.88rem;
      font-weight: 700;
      color: #4b5563;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .tab-btn.active {
      background: #ffffff;
      color: #714b67;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    }

    .status-alert {
      padding: 0.85rem 1rem;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: space-between;

      &.success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
      &.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    }

    .dismiss-btn { background: transparent; border: none; font-weight: 700; cursor: pointer; opacity: 0.7; }

    .sorting-form-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 1.5rem;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      h3 { margin: 0; font-size: 1.1rem; font-weight: 800; color: #111827; letter-spacing: -0.01em; }
    }

    .badge-tag {
      background: rgba(113, 75, 103, 0.1);
      color: #714b67;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 4px 9px;
      border-radius: 6px;
      letter-spacing: 0.03em;

      &.accent { background: rgba(217, 119, 6, 0.12); color: #d97706; }
    }

    /* List View Controls Bar */
    .list-controls-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.5rem;
    }

    .filter-pills {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      overflow-x: auto;
    }

    .filter-btn {
      padding: 0.4rem 0.75rem;
      border: 1px solid #d1d5db;
      background: #f9fafb;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #374151;
      cursor: pointer;
      white-space: nowrap;

      &.active {
        background: #714b67;
        color: #ffffff;
        border-color: #714b67;
        font-weight: 700;
      }
      &.green.active { background: #10b981; border-color: #10b981; }
      &.amber.active { background: #d97706; border-color: #d97706; }
    }

    .refresh-btn {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 5px 12px;
      font-size: 0.78rem;
      font-weight: 700;
      color: #374151;
      cursor: pointer;
      &:hover { background: #e5e7eb; }
    }

    .empty-list-box {
      text-align: center;
      padding: 1.75rem;
      background: #f9fafb;
      border: 2px dashed #d1d5db;
      border-radius: 10px;
      font-size: 0.85rem;
      color: #6b7280;
      font-weight: 500;
    }

    .lite-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;

      th {
        text-align: left;
        padding: 0.75rem;
        background: #f9fafb;
        color: #4b5563;
        font-weight: 700;
        border-bottom: 1px solid #e5e7eb;
      }

      td {
        padding: 0.75rem;
        border-bottom: 1px solid #e5e7eb;
      }
    }

    .font-mono { font-family: monospace; }
    .font-bold { font-weight: 700; }

    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 999px;

      .dot { width: 6px; height: 6px; border-radius: 50%; }

      &.not-started {
        background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;
        .dot { background: #10b981; }
      }

      &.in-sorting {
        background: #fffbe6; color: #d97706; border: 1px solid #fef08a;
        .dot { background: #f59e0b; }
      }
    }

    .start-action-btn {
      background: linear-gradient(135deg, #714b67 0%, #54344d 100%);
      color: #ffffff;
      border: none;
      padding: 6px 12px;
      border-radius: 7px;
      font-size: 0.8rem;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(113, 75, 103, 0.2);

      &.secondary {
        background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
        box-shadow: 0 2px 6px rgba(217, 119, 6, 0.2);
      }

      &:hover { transform: translateY(-1px); }
    }

    .resume-action-btn {
      background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
      color: #ffffff;
      border: none;
      padding: 6px 12px;
      border-radius: 7px;
      font-size: 0.8rem;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(217, 119, 6, 0.25);
      &:hover { transform: translateY(-1px); }
    }

    .rags-card-stack {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .rag-list-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .bale-code {
        font-family: monospace;
        font-weight: 800;
        font-size: 0.95rem;
        color: #111827;
      }
    }

    .card-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;

      .cat-name { color: #4b5563; }
      .weight-tag { font-weight: 800; color: #714b67; }
    }

    .card-action {
      margin-top: 0.25rem;
      button { width: 100%; height: 42px; font-size: 0.88rem; }
    }

    /* Active Session Panel Styles */
    .active-header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .back-link-btn {
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 7px;
        padding: 5px 12px;
        font-size: 0.8rem;
        font-weight: 700;
        color: #374151;
        cursor: pointer;
        &:hover { background: #e5e7eb; }
      }

      .active-tag {
        font-size: 0.72rem;
        font-weight: 900;
        color: #714b67;
        letter-spacing: 0.05em;

        &.amber { color: #d97706; }
      }
    }

    .session-meta-pill {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.82rem;

      &.grade { background: #fffbe6; border-color: #ffe58f; }

      .meta-item {
        display: flex;
        justify-content: space-between;
        .lbl { color: #6b7280; }
        .val { font-weight: 700; color: #111827; &.highlight { color: #714b67; } }
      }
    }

    .weight-tracker-bar {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.8rem;
    }

    .tracker-stats {
      display: flex;
      justify-content: space-between;
      .rem { color: #d97706; }
    }

    .progress-bg {
      height: 10px;
      background: #e5e7eb;
      border-radius: 999px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: #714b67;
      transition: width 0.3s ease;
    }

    .bucket-entry-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 1rem;
      border-radius: 10px;
    }

    .form-title {
      font-size: 0.82rem;
      font-weight: 800;
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .category-chip-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    }

    .chip-btn {
      padding: 0.65rem 0.5rem;
      border: 1px solid #d1d5db;
      background: #ffffff;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #374151;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;

      &.selected { background: #714b67; color: #ffffff; border-color: #714b67; }
      &.grade.selected { background: #d97706; border-color: #d97706; }
    }

    .weight-input-box {
      display: flex;
      align-items: center;
      border: 2px solid #714b67;
      border-radius: 10px;
      overflow: hidden;
      background: #ffffff;
    }

    .weight-field {
      flex: 1;
      height: 48px;
      border: none;
      padding: 0 1rem;
      font-size: 1.35rem;
      font-weight: 700;
      color: #111827;
      outline: none;
    }

    .unit-tag {
      padding: 0 1rem;
      font-weight: 700;
      color: #714b67;
      font-size: 0.95rem;
    }

    .preset-buttons {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.5rem;

      button {
        height: 36px;
        border: 1px solid #e5e7eb;
        background: #ffffff;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
      }
    }

    .add-bucket-btn {
      height: 46px;
      background: #714b67;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;

      &.secondary { background: #d97706; }
      &:disabled { opacity: 0.5; }
    }

    .logged-buckets-list {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .bucket-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 0.85rem;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 0.85rem;
    }

    .bucket-info {
      display: flex;
      gap: 0.5rem;
      .cat-name { font-weight: 600; color: #111827; }
      .cat-weight { font-weight: 700; color: #714b67; }
    }

    .del-bucket-btn { background: transparent; border: none; cursor: pointer; font-size: 0.9rem; }

    .complete-session-btn {
      height: 52px;
      background: #059669;
      color: #ffffff;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      margin-top: 0.5rem;

      &.secondary { background: #059669; }
      &:disabled { opacity: 0.5; }
    }

    .outputs-list-stack {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .output-item-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 0.85rem;
      display: flex;
      align-items: center;
      justify-content: space-between;

      .weight-badge {
        background: rgba(217, 119, 6, 0.15);
        color: #d97706;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 0.8rem;
        margin-left: 0.5rem;
      }
    }
  `],
})
export class MobileSortingComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly activeStage = signal<number>(1);
  protected readonly allSortingRags = signal<RagItem[]>([]);
  protected readonly ragStatusFilter = signal<'ALL' | 'NOT_STARTED' | 'IN_SORTING'>('ALL');
  
  protected readonly categories = signal<CategoryItem[]>([]);
  protected readonly grades = signal<GradeItem[]>([]);
  protected readonly wasteCategories = signal<WasteCategoryItem[]>([]);
  protected readonly availableCategoryOutputs = signal<CategoryOutputItem[]>([]);

  // Active Sessions Signals
  protected readonly activeSortSession = signal<SortSessionData | null>(null);
  protected readonly activeGradeSession = signal<GradeSessionData | null>(null);

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly statusMessage = signal<string>('');
  protected readonly statusType = signal<'success' | 'error'>('success');

  selectedCategoryId = '';
  selectedCategoryOutputId = '';
  selectedGradeId = '';
  outputWeight: number | null = null;
  gradeWeight: number | null = null;
  selectedStage1WasteCategoryId = '';
  selectedStage2WasteCategoryId = '';

  // Filtered Rags List
  protected readonly filteredRags = computed(() => {
    const list = this.allSortingRags();
    const filter = this.ragStatusFilter();
    if (filter === 'ALL') return list;
    return list.filter((r) => r.status === filter);
  });

  protected readonly readyRagsCount = computed(() => {
    return this.allSortingRags().filter((r) => r.status === 'NOT_STARTED').length;
  });

  protected readonly inSortingRagsCount = computed(() => {
    return this.allSortingRags().filter((r) => r.status === 'IN_SORTING').length;
  });

  // Stage 1 Computed Tally Signals
  protected readonly stage1Buckets = computed(() => {
    return this.activeSortSession()?.sortCategoryBuckets || [];
  });

  protected readonly totalStage1LoggedWeight = computed(() => {
    return this.stage1Buckets().reduce((sum, b) => sum + Number(b.outputWeightKg || 0), 0);
  });

  protected readonly remainingStage1Weight = computed(() => {
    const inputWeight = Number(this.activeSortSession()?.rag?.weightKg || 0);
    return Math.max(0, inputWeight - this.totalStage1LoggedWeight());
  });

  protected readonly stage1YieldPct = computed(() => {
    const inputWeight = Number(this.activeSortSession()?.rag?.weightKg || 0);
    if (inputWeight <= 0) return 0;
    return Math.min(100, Math.round((this.totalStage1LoggedWeight() / inputWeight) * 100));
  });

  // Stage 2 Computed Tally Signals
  protected readonly stage2Buckets = computed(() => {
    return this.activeGradeSession()?.gradeBuckets || [];
  });

  protected readonly totalStage2LoggedWeight = computed(() => {
    return this.stage2Buckets().reduce((sum, bucket) => sum + Number(bucket.outputWeightKg || 0), 0);
  });

  protected readonly remainingStage2Weight = computed(() => {
    const input = Number(this.activeGradeSession()?.categoryOutput?.outputWeightKg || 0);
    return Math.max(0, input - this.totalStage2LoggedWeight());
  });

  constructor(
    private readonly http: HttpClient,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (params['stage']) {
        this.activeStage.set(Number(params['stage']) || 1);
      }
      if (params['baleCode']) {
        // Auto-highlight or find by baleCode if passed
      }
      if (params['resumeSort']) {
        this.activeStage.set(1);
        this.refreshActiveSortSession(params['resumeSort']);
      }
      if (params['resumeGrade']) {
        this.activeStage.set(2);
        this.refreshActiveGradeSession(params['resumeGrade']);
      }
    });

    this.fetchMasterData();
  }

  setStage(stage: number): void {
    this.activeStage.set(stage);
    this.statusMessage.set('');
  }

  protected trackById(_index: number, item: { id: string }): string {
    return item.id;
  }

  addPresetWeight(amount: number): void {
    this.outputWeight = (this.outputWeight || 0) + amount;
  }

  fetchMasterData(): void {
    // Fetch Rags (NOT_STARTED and IN_SORTING)
    this.http.get<any>(`${API_BASE_URL}/procurement/rags?limit=100`).subscribe({
      next: (res) => {
        const rags = Array.isArray(res) ? res : (res?.data || []);
        // Filter only NOT_STARTED and IN_SORTING for active sorting hub
        const activeRags = rags.filter((r: RagItem) => r.status === 'NOT_STARTED' || r.status === 'IN_SORTING');
        this.allSortingRags.set(activeRags);
      },
      error: () => {},
    });

    // Fetch Categories
    this.http.get<any[]>(`${API_BASE_URL}/tenant/categories`).subscribe({
      next: (data) => this.categories.set(data || []),
      error: () => {},
    });

    // Fetch Grades
    this.http.get<any[]>(`${API_BASE_URL}/tenant/grades`).subscribe({
      next: (data) => this.grades.set(data || []),
      error: () => {},
    });

    this.http.get<WasteCategoryItem[]>(`${API_BASE_URL}/tenant/waste-categories`).subscribe({
      next: (categories) => this.wasteCategories.set(categories || []),
      error: () => this.wasteCategories.set([]),
    });

    // Fetch Category Outputs ready for Stage 2 Grading
    this.http.get<any>(`${API_BASE_URL}/sorting/stage1/category-outputs/available-for-grading`).subscribe({
      next: (res) => {
        const outputs = Array.isArray(res) ? res : (res?.data || []);
        this.availableCategoryOutputs.set(outputs);
      },
      error: () => {},
    });
  }

  // =========================================================
  // STAGE 1 SORT SESSION METHODS
  // =========================================================
  startSortSessionForRag(ragId: string): void {
    this.isSubmitting.set(true);
    this.statusMessage.set('');
    this.selectedStage1WasteCategoryId = '';

    this.http.post<any>(`${API_BASE_URL}/sorting/stage1/sessions`, { ragId }).subscribe({
      next: (session) => {
        this.isSubmitting.set(false);
        this.activeSortSession.set(session);
        this.statusType.set('success');
        this.statusMessage.set(`Sorting Session started for ${session.rag?.ragCode || 'Rag'}!`);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.statusType.set('error');
        this.statusMessage.set(err?.error?.message || 'Failed to start sorting session');
      },
    });
  }

  resumeSortSessionForRag(rag: RagItem): void {
    this.isSubmitting.set(true);
    this.statusMessage.set('');

    // Fetch active session by rag or list active session (Prisma SortStatus enum is OPEN)
    this.http.get<any>(`${API_BASE_URL}/sorting/stage1/sessions?status=OPEN`).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        const sessions = Array.isArray(res) ? res : (res?.data || []);
        const match = sessions.find((s: any) => s.ragId === rag.id || s.rag?.id === rag.id || s.rag?.ragCode === rag.ragCode);
        if (match) {
          this.refreshActiveSortSession(match.id);
        } else {
          // If match not found in list, attempt direct fetch or create
          this.startSortSessionForRag(rag.id);
        }
      },
      error: () => {
        this.isSubmitting.set(false);
        this.startSortSessionForRag(rag.id);
      },
    });
  }

  addCategoryBucket(): void {
    const session = this.activeSortSession();
    if (!session || !this.selectedCategoryId || !this.outputWeight) return;

    this.isSubmitting.set(true);
    this.statusMessage.set('');

    const payload = {
      categoryId: this.selectedCategoryId,
      outputWeightKg: this.outputWeight,
    };

    this.http.post<any>(`${API_BASE_URL}/sorting/stage1/sessions/${session.id}/buckets`, payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.statusType.set('success');
        this.statusMessage.set('Category output bucket logged!');
        this.outputWeight = null;
        this.refreshActiveSortSession(session.id);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.statusType.set('error');
        this.statusMessage.set(err?.error?.message || 'Failed to add bucket');
      },
    });
  }

  deleteStage1Bucket(bucketId: string): void {
    const session = this.activeSortSession();
    if (!session) return;

    this.http.delete(`${API_BASE_URL}/sorting/stage1/buckets/${bucketId}`).subscribe({
      next: () => {
        this.refreshActiveSortSession(session.id);
      },
      error: () => {},
    });
  }

  closeSortSession(): void {
    const session = this.activeSortSession();
    if (!session) return;

    this.isSubmitting.set(true);
    this.statusMessage.set('');

    this.http.post(`${API_BASE_URL}/sorting/stage1/sessions/${session.id}/close`, {
      ...(this.selectedStage1WasteCategoryId ? { wasteCategoryId: this.selectedStage1WasteCategoryId } : {}),
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.activeSortSession.set(null);
        this.selectedStage1WasteCategoryId = '';
        this.statusType.set('success');
        this.statusMessage.set('Sorting session closed & category outputs created!');
        this.fetchMasterData();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.statusType.set('error');
        this.statusMessage.set(err?.error?.message || 'Failed to close session');
      },
    });
  }

  private refreshActiveSortSession(sessionId: string): void {
    this.http.get<any>(`${API_BASE_URL}/sorting/stage1/sessions/${sessionId}`).subscribe({
      next: (session) => this.activeSortSession.set(session),
      error: () => {},
    });
  }

  // =========================================================
  // STAGE 2 GRADE SESSION METHODS
  // =========================================================
  startGradeSessionForOutput(categoryOutputId: string): void {
    this.isSubmitting.set(true);
    this.statusMessage.set('');
    this.selectedStage2WasteCategoryId = '';

    this.http.post<any>(`${API_BASE_URL}/sorting/stage2/sessions`, { categoryOutputId }).subscribe({
      next: (session) => {
        this.isSubmitting.set(false);
        this.activeGradeSession.set(session);
        this.statusType.set('success');
        this.statusMessage.set(`Grade Session started for ${session.categoryOutput?.category?.name || 'Category'}!`);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.statusType.set('error');
        this.statusMessage.set(err?.error?.message || 'Failed to start grade session');
      },
    });
  }

  addGradeBucket(): void {
    const session = this.activeGradeSession();
    if (!session || !this.selectedGradeId || !this.gradeWeight) return;

    this.isSubmitting.set(true);
    this.statusMessage.set('');

    const payload = {
      gradeId: this.selectedGradeId,
      outputWeightKg: Number(this.gradeWeight),
      outputCount: 1,
    };

    this.http.post<any>(`${API_BASE_URL}/sorting/stage2/sessions/${session.id}/buckets`, payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.statusType.set('success');
        this.statusMessage.set('Grade output bucket logged!');
        this.gradeWeight = null;
        this.refreshActiveGradeSession(session.id);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.statusType.set('error');
        this.statusMessage.set(err?.error?.message || 'Failed to add grade bucket');
      },
    });
  }

  deleteStage2Bucket(bucketId: string): void {
    const session = this.activeGradeSession();
    if (!session) return;

    this.http.delete(`${API_BASE_URL}/sorting/stage2/buckets/${bucketId}`).subscribe({
      next: () => {
        this.refreshActiveGradeSession(session.id);
      },
      error: () => {},
    });
  }

  closeGradeSession(): void {
    const session = this.activeGradeSession();
    if (!session) return;

    this.isSubmitting.set(true);
    this.statusMessage.set('');

    this.http.post(`${API_BASE_URL}/sorting/stage2/sessions/${session.id}/close`, {
      ...(this.selectedStage2WasteCategoryId ? { wasteCategoryId: this.selectedStage2WasteCategoryId } : {}),
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.activeGradeSession.set(null);
        this.selectedCategoryOutputId = '';
        this.selectedStage2WasteCategoryId = '';
        this.statusType.set('success');
        this.statusMessage.set('Grade session closed & grade outputs created!');
        this.fetchMasterData();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.statusType.set('error');
        this.statusMessage.set(err?.error?.message || 'Failed to close grade session');
      },
    });
  }

  private refreshActiveGradeSession(sessionId: string): void {
    this.http.get<any>(`${API_BASE_URL}/sorting/stage2/sessions/${sessionId}`).subscribe({
      next: (session) => this.activeGradeSession.set(session),
      error: () => {},
    });
  }
}
