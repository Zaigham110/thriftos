import { Directive, ElementRef, OnInit, Renderer2, inject } from '@angular/core';

@Directive({
  selector: 'select[appSelect], select[uiSelect]',
  standalone: true,
})
export class SelectDirective implements OnInit {
  private readonly elementRef = inject<ElementRef<HTMLSelectElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  ngOnInit(): void {
    this.renderer.addClass(this.elementRef.nativeElement, 'select');
  }
}
