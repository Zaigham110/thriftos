import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WorkQueueService } from '../../../core/operations/work-queue.service';
import { OfflineDraftService } from '../../../core/operations/offline-draft.service';

@Component({
  selector: 'app-mobile-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="lite-home-view">
      <!-- Welcome Hero Card -->
      <div class="welcome-card">
        <div class="hero-text">
          <h2>My Work</h2>
          <p>Your ready material, resumable work, and the next approved action.</p>
        </div>
        <div class="quick-status-pills">
          <div class="status-pill">
            <span class="pill-val">{{ workQueue.queue()?.summary?.readyRags || 0 }}</span>
            <span class="pill-lbl">Rags Ready</span>
          </div>
          <div class="status-pill highlight">
            <span class="pill-val">{{ workQueue.queue()?.tasks?.length || 0 }}</span>
            <span class="pill-lbl">To Resume</span>
          </div>
        </div>
      </div>

      @if (workQueue.loading()) {
        <div class="queue-state">Refreshing your work queue…</div>
      } @else if (workQueue.error()) {
        <div class="queue-state error">
          {{ workQueue.error() }}
          <button type="button" (click)="workQueue.load()">Try again</button>
        </div>
      } @else if (workQueue.queue(); as queue) {
        @if (offlineDrafts.conflictedDrafts().length) {
          <section class="conflict-section" aria-label="Drafts requiring review">
            <div class="action-grid-title">Sync review</div>
            @for (draft of offlineDrafts.conflictedDrafts(); track draft.id) {
              <div class="conflict-card">
                <div>
                  <strong>{{ draft.type === 'RAG_INTAKE' ? 'Intake draft needs review' : draft.type }}</strong>
                  <small>{{ draft.lastError }}</small>
                </div>
                <button type="button" [disabled]="!offlineDrafts.isOnline()" (click)="offlineDrafts.retry(draft)">Retry</button>
              </div>
            }
          </section>
        }
        @if (queue.blockers.length) {
          <section class="blocker-section" aria-label="Blocked work">
            <div class="action-grid-title">Needs attention</div>
            @for (blocker of queue.blockers; track blocker.type) {
              <a [routerLink]="blocker.route" class="blocker-card">
                <span class="blocker-count">{{ blocker.count }}</span>
                <span><strong>{{ blocker.title }}</strong><small>{{ blocker.detail }}</small></span>
                <span aria-hidden="true">→</span>
              </a>
            }
          </section>
        }
        <section class="next-action-card">
          <div>
            <span class="eyebrow">Recommended next action</span>
            <h3>{{ queue.nextAction.label }}</h3>
            <p>Lifecycle rules and your tenant policy are applied before the work begins.</p>
          </div>
          <a [routerLink]="queue.nextAction.route" class="next-action-button">Start →</a>
        </section>

        @if (queue.tasks.length) {
          <section class="resume-section">
            <div class="action-grid-title">Resume work</div>
            @for (task of queue.tasks; track task.id) {
              <a [routerLink]="task.route" class="resume-task">
                <span>{{ task.title }}</span><span aria-hidden="true">→</span>
              </a>
            }
          </section>
        }
      }

      <!-- Quick Action Grid (Big Touch Cards) -->
      <div class="action-grid-title">Lite ERP Workstations</div>

      <div class="touch-actions-grid">
        <!-- Action 0: Raw Bale Buying & Intake -->
        <a routerLink="/app/lite/buying" class="action-card buying">
          <div class="action-icon">
            <span style="font-size: 1.5rem;">🛍️</span>
          </div>
          <div class="action-details">
            <h3>Raw Bale Buying & Intake</h3>
            <p>Record raw bale purchase, combo weight & cost</p>
          </div>
          <div class="action-arrow">→</div>
        </a>

        <!-- Action 1: Sorting Stage 1 -->
        <a routerLink="/app/lite/sorting" class="action-card primary">
          <div class="action-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          </div>
          <div class="action-details">
            <h3>Category Sorting</h3>
            <p>Stage 1 — Process raw Rags into Categories</p>
          </div>
          <div class="action-arrow">→</div>
        </a>

        <!-- Action 2: Sorting Stage 2 (Grading) -->
        <a routerLink="/app/lite/sorting" [queryParams]="{ stage: 2 }" class="action-card secondary">
          <div class="action-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l4.58-4.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>
          </div>
          <div class="action-details">
            <h3>Grading Station</h3>
            <p>Stage 2 — Grade category outputs into Quality</p>
          </div>
          <div class="action-arrow">→</div>
        </a>

        <!-- Action 3: Repack & Bundling -->
        <a routerLink="/app/lite/repack" class="action-card accent">
          <div class="action-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
          </div>
          <div class="action-details">
            <h3>Create Repack Bundle</h3>
            <p>Build 40kg bales / pcs & generate QR label</p>
          </div>
          <div class="action-arrow">→</div>
        </a>

        <!-- Action 4: QR Lookup & Inventory -->
        <a routerLink="/app/lite/lookup" class="action-card info">
          <div class="action-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>
          </div>
          <div class="action-details">
            <h3>QR Lookup & Stock</h3>
            <p>Scan QR label or search inventory items</p>
          </div>
          <div class="action-arrow">→</div>
        </a>

        <!-- Action 5: Quick Sale -->
        <a routerLink="/app/lite/quick-sale" class="action-card success">
          <div class="action-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
          </div>
          <div class="action-details">
            <h3>POS Quick Sale</h3>
            <p>Create & issue sales orders on the floor</p>
          </div>
          <div class="action-arrow">→</div>
        </a>
      </div>
    </div>
  `,
  styles: [`
    .lite-home-view {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .welcome-card {
      background: linear-gradient(135deg, #714b67 0%, #54344d 100%);
      color: #ffffff;
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(113, 75, 103, 0.2);
    }

    .hero-text h2 {
      margin: 0 0 0.25rem 0;
      font-size: 1.45rem;
      font-weight: 800;
    }

    .hero-text p {
      margin: 0 0 1rem 0;
      font-size: 0.9rem;
      opacity: 0.9;
    }

    .quick-status-pills {
      display: flex;
      gap: 0.75rem;
    }

    .status-pill {
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 0.5rem 0.85rem;
      display: flex;
      flex-direction: column;
    }

    .status-pill.highlight {
      background: rgba(255, 255, 255, 0.25);
      border-color: rgba(255, 255, 255, 0.4);
    }

    .pill-val { font-size: 1.2rem; font-weight: 700; line-height: 1.2; }
    .pill-lbl { font-size: 0.7rem; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.03em; }

    .action-grid-title {
      font-size: 0.9rem; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;
    }

    .next-action-card { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1.1rem; border: 1px solid #d9c9d5; border-radius: 12px; background: #fffafa; }
    .next-action-card h3 { margin: .2rem 0; color: #402238; font-size: 1.05rem; }
    .next-action-card p { margin: 0; color: #6b7280; font-size: .82rem; }
    .eyebrow { color: #714b67; font-size: .68rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .next-action-button { min-height: 48px; display: inline-flex; align-items: center; padding: 0 1rem; border-radius: 8px; background: #714b67; color: #fff; text-decoration: none; font-weight: 700; white-space: nowrap; }
    .resume-section { display: grid; gap: .55rem; }
    .blocker-section { display: grid; gap: .55rem; }
    .conflict-section { display: grid; gap: .55rem; }
    .conflict-card { display: flex; align-items: center; justify-content: space-between; gap: .75rem; padding: .8rem; border: 1px solid #fecaca; border-radius: 10px; background: #fef2f2; color: #991b1b; }
    .conflict-card strong, .conflict-card small { display: block; }
    .conflict-card strong { font-size: .85rem; }
    .conflict-card small { margin-top: .15rem; font-size: .73rem; line-height: 1.35; }
    .conflict-card button { min-height: 40px; border: 1px solid #b91c1c; border-radius: 7px; padding: 0 .7rem; background: #fff; color: #991b1b; font-weight: 700; }
    .conflict-card button:disabled { opacity: .45; }
    .blocker-card { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .75rem; padding: .8rem; border: 1px solid #fed7aa; border-radius: 10px; background: #fff7ed; color: #9a3412; text-decoration: none; }
    .blocker-card strong, .blocker-card small { display: block; }
    .blocker-card strong { font-size: .86rem; }
    .blocker-card small { margin-top: .15rem; color: #9a3412; font-size: .74rem; line-height: 1.35; }
    .blocker-count { min-width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; background: #ea580c; color: #fff; font-weight: 800; }
    .resume-task { min-height: 48px; display: flex; align-items: center; justify-content: space-between; padding: .75rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; color: #374151; text-decoration: none; font-size: .9rem; font-weight: 650; }
    .queue-state { padding: .8rem 1rem; border-radius: 8px; background: #f3f4f6; color: #4b5563; font-size: .85rem; }
    .queue-state.error { background: #fef2f2; color: #991b1b; }
    .queue-state button { margin-left: .5rem; border: 0; background: none; color: inherit; font-weight: 700; text-decoration: underline; cursor: pointer; }

    .touch-actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }

    .action-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.15rem;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      text-decoration: none;
      color: inherit;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      transition: all 0.15s ease;
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }
    }

    .action-icon {
      display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 10px; flex-shrink: 0;
    }

    .action-card.buying .action-icon { background-color: rgba(5, 150, 105, 0.12); color: #059669; }
    .action-card.primary .action-icon { background-color: rgba(113, 75, 103, 0.12); color: #714b67; }
    .action-card.secondary .action-icon { background-color: rgba(217, 119, 6, 0.12); color: #d97706; }
    .action-card.accent .action-icon { background-color: rgba(79, 70, 229, 0.12); color: #4f46e5; }
    .action-card.info .action-icon { background-color: rgba(14, 165, 233, 0.12); color: #0ea5e9; }
    .action-card.success .action-icon { background-color: rgba(16, 185, 129, 0.12); color: #10b981; }

    .action-details { flex: 1; }
    .action-details h3 { margin: 0 0 0.2rem 0; font-size: 1rem; font-weight: 700; color: #111827; }
    .action-details p { margin: 0; font-size: 0.8rem; color: #6b7280; }
    .action-arrow { font-size: 1.2rem; font-weight: 700; color: #9ca3af; }
  `],
})
export class MobileHomeComponent implements OnInit {
  protected readonly workQueue = inject(WorkQueueService);
  protected readonly offlineDrafts = inject(OfflineDraftService);

  ngOnInit(): void {
    this.workQueue.load();
  }
}
